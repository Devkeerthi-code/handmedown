-- HandMeDown: integrity checks, search, Row Level Security, triggers,
-- storage bucket + policies and Realtime authorization.
-- Written by hand because Prisma can't express these. Applied with `prisma migrate deploy`.

------------------------------------------------------------------------------
-- 1. Integrity constraints the app relies on (enforced even if a bug slips through)
------------------------------------------------------------------------------
ALTER TABLE app.profiles
  ADD CONSTRAINT profiles_display_name_len CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 40),
  -- Deleting an Auth user removes their profile and, by cascade, everything they own.
  ADD CONSTRAINT profiles_auth_user_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE app.listings
  ADD CONSTRAINT listings_title_len CHECK (char_length(btrim(title)) BETWEEN 3 AND 80),
  ADD CONSTRAINT listings_price_rule CHECK (
    (price_type = 'fixed' AND price BETWEEN 1 AND 500000)
    OR (price_type <> 'fixed' AND price IS NULL)
  ),
  ADD CONSTRAINT listings_original_price_range CHECK (original_price IS NULL OR original_price BETWEEN 1 AND 1000000),
  ADD CONSTRAINT listings_exchange_only_for_exchange CHECK (price_type = 'exchange' OR exchange_for IS NULL),
  ADD CONSTRAINT listings_isbn_format CHECK (isbn IS NULL OR isbn ~ '^97[89][0-9]{10}$'),
  ADD CONSTRAINT listings_semester_range CHECK (book_semester IS NULL OR book_semester BETWEEN 1 AND 10),
  ADD CONSTRAINT listings_book_fields_only_for_books CHECK (
    category = 'books'
    OR (isbn IS NULL AND book_semester IS NULL AND book_subject IS NULL AND book_author IS NULL)
  );

ALTER TABLE app.listing_photos
  ADD CONSTRAINT listing_photos_position_range CHECK (position BETWEEN 0 AND 4),
  ADD CONSTRAINT listing_photos_size_positive CHECK (width > 0 AND height > 0),
  ADD CONSTRAINT listing_photos_path_format CHECK (
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
  );

ALTER TABLE app.conversations
  ADD CONSTRAINT conversations_not_self CHECK (buyer_id <> seller_id);

ALTER TABLE app.messages
  ADD CONSTRAINT messages_body_len CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000);

ALTER TABLE app.blocks
  ADD CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id);

ALTER TABLE app.reports
  ADD CONSTRAINT reports_has_target CHECK (listing_id IS NOT NULL OR reported_user_id IS NOT NULL);

CREATE UNIQUE INDEX reports_one_open_per_listing
  ON app.reports (reporter_id, listing_id) WHERE listing_id IS NOT NULL AND status = 'open';
CREATE UNIQUE INDEX reports_one_open_per_user
  ON app.reports (reporter_id, reported_user_id) WHERE listing_id IS NULL AND status = 'open';

ALTER TABLE app.wishlist_alerts
  ADD CONSTRAINT alerts_max_price_positive CHECK (max_price IS NULL OR max_price BETWEEN 1 AND 500000),
  ADD CONSTRAINT alerts_has_criteria CHECK (
    query IS NOT NULL OR category IS NOT NULL OR max_price IS NOT NULL OR free_only
  );

------------------------------------------------------------------------------
-- 2. Full-text search + feed indexes
------------------------------------------------------------------------------
ALTER TABLE app.listings ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(title, '')), 'A')
  || setweight(to_tsvector('english', coalesce(book_subject, '') || ' ' || coalesce(book_author, '')), 'B')
  || setweight(to_tsvector('english', coalesce(description, '')), 'C')
) STORED;

CREATE INDEX listings_search_idx ON app.listings USING gin (search_vector);
-- Feed = visible, not sold. Keyset pagination walks (created_at, id) backwards.
CREATE INDEX listings_feed_idx ON app.listings (created_at DESC, id DESC)
  WHERE NOT is_hidden AND status <> 'sold';
CREATE INDEX listings_feed_category_idx ON app.listings (category, created_at DESC, id DESC)
  WHERE NOT is_hidden AND status <> 'sold';
CREATE INDEX listings_isbn_idx ON app.listings (isbn) WHERE isbn IS NOT NULL;

-- "calc fx" -> 'calc':* & 'fx':*  (prefix match so search works while typing)
CREATE FUNCTION app.prefix_tsquery(q text) RETURNS tsquery
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE WHEN count(*) = 0 THEN NULL
              ELSE to_tsquery('english'::regconfig, string_agg(tok || ':*', ' & '))
         END
  FROM (
    SELECT tok
    FROM regexp_split_to_table(lower(coalesce(q, '')), '[^a-z0-9]+') AS tok
    WHERE tok <> ''
    LIMIT 8
  ) AS tokens
$$;

------------------------------------------------------------------------------
-- 3. Helper functions used by policies (SECURITY DEFINER so they can read
--    tables the caller can't, with a pinned search_path)
------------------------------------------------------------------------------
CREATE FUNCTION app.is_verified(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.profiles p
    WHERE p.id = uid AND p.verified_at IS NOT NULL AND p.banned_at IS NULL
  )
$$;

CREATE FUNCTION app.is_active_user(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM app.profiles p WHERE p.id = uid AND p.banned_at IS NULL)
$$;

CREATE FUNCTION app.is_admin(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM app.profiles p WHERE p.id = uid AND p.is_admin)
$$;

CREATE FUNCTION app.is_blocked_between(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.blocks bl
    WHERE (bl.blocker_id = a AND bl.blocked_id = b) OR (bl.blocker_id = b AND bl.blocked_id = a)
  )
$$;

CREATE FUNCTION app.is_participant(conv uuid, uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.conversations c
    WHERE c.id = conv AND (c.buyer_id = uid OR c.seller_id = uid)
  )
$$;

CREATE FUNCTION app.conversation_is_blocked(conv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.conversations c
    WHERE c.id = conv AND app.is_blocked_between(c.buyer_id, c.seller_id)
  )
$$;

-- Realtime topics: "conversation:<uuid>" for participants, "user:<uuid>" for that user only.
CREATE FUNCTION app.can_join_topic(topic text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  rest text;
BEGIN
  IF uid IS NULL OR topic IS NULL THEN
    RETURN false;
  END IF;
  IF topic LIKE 'conversation:%' THEN
    rest := substr(topic, 14);
    RETURN rest ~ uuid_re AND app.is_participant(rest::uuid, uid);
  ELSIF topic LIKE 'user:%' THEN
    rest := substr(topic, 6);
    RETURN rest = uid::text;
  END IF;
  RETURN false;
END
$$;

------------------------------------------------------------------------------
-- 4. Privileges. The app schema is not exposed through the Data API; these
--    grants are what the server's RLS-scoped connections run with.
------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;
GRANT USAGE ON SCHEMA app TO anon, authenticated;

GRANT SELECT ON app.profiles, app.listings, app.listing_photos TO anon, authenticated;
GRANT UPDATE (display_name) ON app.profiles TO authenticated;

GRANT INSERT, DELETE ON app.listings TO authenticated;
GRANT UPDATE (title, description, category, condition, price_type, price, original_price,
              exchange_for, pickup_spot, status, is_hidden, isbn, book_semester,
              book_subject, book_author, updated_at)
  ON app.listings TO authenticated;
GRANT INSERT, DELETE ON app.listing_photos TO authenticated;

GRANT SELECT, INSERT ON app.conversations TO authenticated;
GRANT SELECT, INSERT ON app.messages TO authenticated;
GRANT USAGE ON SEQUENCE app.messages_id_seq TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app.conversation_reads TO authenticated;
GRANT SELECT, INSERT, DELETE ON app.blocks TO authenticated;
GRANT SELECT, INSERT ON app.reports TO authenticated;
GRANT UPDATE (status, resolved_by, resolved_at) ON app.reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.wishlist_alerts TO authenticated;
GRANT SELECT, INSERT, DELETE ON app.push_subscriptions TO authenticated;
GRANT SELECT ON app.alert_deliveries TO authenticated;
-- allowed_domains and usage_events: no client roles at all.

GRANT EXECUTE ON FUNCTION app.prefix_tsquery(text), app.is_verified(uuid), app.is_active_user(uuid),
  app.is_admin(uuid), app.is_blocked_between(uuid, uuid), app.is_participant(uuid, uuid),
  app.conversation_is_blocked(uuid), app.can_join_topic(text)
  TO anon, authenticated;

------------------------------------------------------------------------------
-- 5. Row Level Security: on for every table, default deny
------------------------------------------------------------------------------
ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.listing_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.wishlist_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.usage_events ENABLE ROW LEVEL SECURITY;

-- profiles: public display info; you can rename yourself (column grant limits it to display_name)
CREATE POLICY profiles_read ON app.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_update_self ON app.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- listings: everyone sees visible ones; owners and admins also see hidden ones
CREATE POLICY listings_read ON app.listings FOR SELECT TO anon, authenticated
  USING (
    NOT is_hidden
    OR seller_id = (SELECT auth.uid())
    OR app.is_admin((SELECT auth.uid()))
  );
CREATE POLICY listings_insert_verified_owner ON app.listings FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = (SELECT auth.uid())
    AND app.is_verified((SELECT auth.uid()))
    AND NOT is_hidden AND NOT is_demo AND status = 'active'
  );
CREATE POLICY listings_update_owner_or_admin ON app.listings FOR UPDATE TO authenticated
  USING (seller_id = (SELECT auth.uid()) OR app.is_admin((SELECT auth.uid())))
  WITH CHECK (seller_id = (SELECT auth.uid()) OR app.is_admin((SELECT auth.uid())));
CREATE POLICY listings_delete_owner_or_admin ON app.listings FOR DELETE TO authenticated
  USING (seller_id = (SELECT auth.uid()) OR app.is_admin((SELECT auth.uid())));

-- photos follow their listing (the subquery is itself filtered by listings_read)
CREATE POLICY photos_read ON app.listing_photos FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM app.listings l WHERE l.id = listing_id));
CREATE POLICY photos_insert_owner ON app.listing_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app.listings l WHERE l.id = listing_id AND l.seller_id = (SELECT auth.uid()))
    AND split_part(storage_path, '/', 1) = (SELECT auth.uid())::text
  );
CREATE POLICY photos_delete_owner ON app.listing_photos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM app.listings l WHERE l.id = listing_id AND l.seller_id = (SELECT auth.uid())));

-- conversations: only the two participants; a buyer opens one on a visible, unsold listing
CREATE POLICY conversations_read_participants ON app.conversations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (buyer_id, seller_id));
CREATE POLICY conversations_insert_buyer ON app.conversations FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = (SELECT auth.uid())
    AND app.is_active_user((SELECT auth.uid()))
    AND NOT app.is_blocked_between(buyer_id, seller_id)
    AND EXISTS (
      SELECT 1 FROM app.listings l
      WHERE l.id = listing_id AND l.seller_id = conversations.seller_id
        AND NOT l.is_hidden AND l.status <> 'sold'
    )
  );

-- messages: participants read; participants send only as themselves and only if nobody blocked anybody
CREATE POLICY messages_read_participants ON app.messages FOR SELECT TO authenticated
  USING (app.is_participant(conversation_id, (SELECT auth.uid())));
CREATE POLICY messages_insert_participant ON app.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND app.is_participant(conversation_id, (SELECT auth.uid()))
    AND NOT app.conversation_is_blocked(conversation_id)
    AND app.is_active_user((SELECT auth.uid()))
  );

CREATE POLICY reads_own ON app.conversation_reads FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()) AND app.is_participant(conversation_id, (SELECT auth.uid())));

CREATE POLICY blocks_own ON app.blocks FOR ALL TO authenticated
  USING (blocker_id = (SELECT auth.uid()))
  WITH CHECK (blocker_id = (SELECT auth.uid()));

CREATE POLICY reports_insert_own ON app.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()) AND status = 'open' AND resolved_by IS NULL);
CREATE POLICY reports_read_own_or_admin ON app.reports FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR app.is_admin((SELECT auth.uid())));
CREATE POLICY reports_update_admin ON app.reports FOR UPDATE TO authenticated
  USING (app.is_admin((SELECT auth.uid()))) WITH CHECK (app.is_admin((SELECT auth.uid())));

CREATE POLICY alerts_own ON app.wishlist_alerts FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY deliveries_read_own ON app.alert_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM app.wishlist_alerts a WHERE a.id = alert_id AND a.user_id = (SELECT auth.uid())));

CREATE POLICY push_own ON app.push_subscriptions FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

------------------------------------------------------------------------------
-- 6. Triggers
------------------------------------------------------------------------------
CREATE FUNCTION app.track(e app."UsageEventType", uid uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ INSERT INTO app.usage_events (event, user_id) VALUES (e, uid) $$;
REVOKE ALL ON FUNCTION app.track(app."UsageEventType", uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app.email_domain_allowed(email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.allowed_domains d
    WHERE lower(split_part(email, '@', 2)) = d.domain
       OR lower(split_part(email, '@', 2)) LIKE '%.' || d.domain
  )
$$;

-- Keeps app.profiles in step with auth.users. Verified = confirmed email on an allowed college domain.
CREATE FUNCTION app.sync_profile_from_auth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  qualifies boolean := NEW.email_confirmed_at IS NOT NULL AND app.email_domain_allowed(NEW.email);
  was_verified boolean;
  wanted_name text := left(btrim(coalesce(NEW.raw_user_meta_data ->> 'display_name', '')), 40);
BEGIN
  IF char_length(wanted_name) < 2 THEN
    wanted_name := left(split_part(NEW.email, '@', 1), 40);
  END IF;
  IF char_length(wanted_name) < 2 THEN
    wanted_name := 'Student';
  END IF;

  -- Seeded DEMO accounts: flagged, shown as verified, never counted in usage.
  IF TG_OP = 'INSERT' AND coalesce(NEW.raw_app_meta_data ->> 'hmd_demo', '') = 'true' THEN
    INSERT INTO app.profiles (id, display_name, verified_at, is_demo)
    VALUES (NEW.id, wanted_name, now(), true)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO app.profiles (id, display_name, verified_at)
    VALUES (NEW.id, wanted_name, CASE WHEN qualifies THEN now() END)
    ON CONFLICT (id) DO NOTHING;
    PERFORM app.track('signup', NEW.id);
    IF qualifies THEN PERFORM app.track('verified', NEW.id); END IF;
    RETURN NEW;
  END IF;

  SELECT verified_at IS NOT NULL INTO was_verified FROM app.profiles WHERE id = NEW.id;
  UPDATE app.profiles
     SET verified_at = CASE WHEN qualifies THEN coalesce(verified_at, now()) END
   WHERE id = NEW.id;
  IF qualifies AND NOT coalesce(was_verified, false) THEN
    PERFORM app.track('verified', NEW.id);
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.sync_profile_from_auth();
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.sync_profile_from_auth();

-- Re-checks every user after the allowed domain list changes (called by scripts/sync-config.ts).
CREATE FUNCTION app.recompute_verification() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  UPDATE app.profiles p
     SET verified_at = CASE
       WHEN u.email_confirmed_at IS NOT NULL AND app.email_domain_allowed(u.email)
         THEN coalesce(p.verified_at, now())
       END
    FROM auth.users u
   WHERE u.id = p.id AND NOT p.is_demo
$$;
REVOKE ALL ON FUNCTION app.recompute_verification() FROM PUBLIC, anon, authenticated;

-- Rate limits live in the database so no code path can skip them.
CREATE FUNCTION app.enforce_rate_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- server-side maintenance (seed, admin scripts)
  END IF;
  IF TG_TABLE_NAME = 'listings' THEN
    SELECT count(*) INTO n FROM app.listings WHERE seller_id = NEW.seller_id AND created_at > now() - interval '1 day';
    IF n >= 15 THEN RAISE EXCEPTION 'RATE_LIMIT:listings' USING ERRCODE = 'P0001'; END IF;
  ELSIF TG_TABLE_NAME = 'messages' THEN
    SELECT count(*) INTO n FROM app.messages WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 minute';
    IF n >= 20 THEN RAISE EXCEPTION 'RATE_LIMIT:messages' USING ERRCODE = 'P0001'; END IF;
  ELSIF TG_TABLE_NAME = 'conversations' THEN
    SELECT count(*) INTO n FROM app.conversations WHERE buyer_id = NEW.buyer_id AND created_at > now() - interval '1 day';
    IF n >= 30 THEN RAISE EXCEPTION 'RATE_LIMIT:conversations' USING ERRCODE = 'P0001'; END IF;
  ELSIF TG_TABLE_NAME = 'reports' THEN
    SELECT count(*) INTO n FROM app.reports WHERE reporter_id = NEW.reporter_id AND created_at > now() - interval '1 day';
    IF n >= 10 THEN RAISE EXCEPTION 'RATE_LIMIT:reports' USING ERRCODE = 'P0001'; END IF;
  ELSIF TG_TABLE_NAME = 'wishlist_alerts' THEN
    SELECT count(*) INTO n FROM app.wishlist_alerts WHERE user_id = NEW.user_id;
    IF n >= 10 THEN RAISE EXCEPTION 'RATE_LIMIT:alerts' USING ERRCODE = 'P0001'; END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER listings_rate_limit BEFORE INSERT ON app.listings FOR EACH ROW EXECUTE FUNCTION app.enforce_rate_limit();
CREATE TRIGGER messages_rate_limit BEFORE INSERT ON app.messages FOR EACH ROW EXECUTE FUNCTION app.enforce_rate_limit();
CREATE TRIGGER conversations_rate_limit BEFORE INSERT ON app.conversations FOR EACH ROW EXECUTE FUNCTION app.enforce_rate_limit();
CREATE TRIGGER reports_rate_limit BEFORE INSERT ON app.reports FOR EACH ROW EXECUTE FUNCTION app.enforce_rate_limit();
CREATE TRIGGER alerts_rate_limit BEFORE INSERT ON app.wishlist_alerts FOR EACH ROW EXECUTE FUNCTION app.enforce_rate_limit();

-- Owners may edit their listing, but only an admin can un-hide a reported one.
CREATE FUNCTION app.guard_listing_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.is_hidden AND NOT NEW.is_hidden
     AND NOT app.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can restore a hidden listing' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'sold' AND OLD.status <> 'sold' THEN
    PERFORM app.track('listing_sold', NEW.seller_id);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;
CREATE TRIGGER listings_guard_update BEFORE UPDATE ON app.listings
  FOR EACH ROW EXECUTE FUNCTION app.guard_listing_update();

CREATE FUNCTION app.after_listing_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT NEW.is_demo THEN
    PERFORM app.track('listing_created', NEW.seller_id);
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER listings_after_insert AFTER INSERT ON app.listings
  FOR EACH ROW EXECUTE FUNCTION app.after_listing_insert();

CREATE FUNCTION app.after_conversation_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM app.track('chat_started', NEW.buyer_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER conversations_after_insert AFTER INSERT ON app.conversations
  FOR EACH ROW EXECUTE FUNCTION app.after_conversation_insert();

-- New message: bump the conversation, mark it read for the sender, push it over Realtime.
CREATE FUNCTION app.after_message_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  recipient uuid;
  payload jsonb;
BEGIN
  UPDATE app.conversations SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id
   RETURNING CASE WHEN buyer_id = NEW.sender_id THEN seller_id ELSE buyer_id END INTO recipient;

  INSERT INTO app.conversation_reads (conversation_id, user_id, last_read_at)
  VALUES (NEW.conversation_id, NEW.sender_id, NEW.created_at)
  ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  PERFORM app.track('message_sent', NEW.sender_id);

  payload := jsonb_build_object(
    'id', NEW.id::text,
    'conversationId', NEW.conversation_id,
    'senderId', NEW.sender_id,
    'body', NEW.body,
    'createdAt', NEW.created_at
  );
  PERFORM realtime.send(payload, 'message', 'conversation:' || NEW.conversation_id::text, true);
  PERFORM realtime.send(
    jsonb_build_object('conversationId', NEW.conversation_id, 'senderId', NEW.sender_id),
    'inbox', 'user:' || recipient::text, true
  );
  RETURN NEW;
END
$$;
CREATE TRIGGER messages_after_insert AFTER INSERT ON app.messages
  FOR EACH ROW EXECUTE FUNCTION app.after_message_insert();

-- A report hides the listing straight away; an admin restores or removes it.
CREATE FUNCTION app.after_report_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.listing_id IS NOT NULL THEN
    UPDATE app.listings SET is_hidden = true WHERE id = NEW.listing_id;
  END IF;
  PERFORM app.track('report_filed', NEW.reporter_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER reports_after_insert AFTER INSERT ON app.reports
  FOR EACH ROW EXECUTE FUNCTION app.after_report_insert();

CREATE FUNCTION app.after_alert_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM app.track('alert_created', NEW.user_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER alerts_after_insert AFTER INSERT ON app.wishlist_alerts
  FOR EACH ROW EXECUTE FUNCTION app.after_alert_insert();

------------------------------------------------------------------------------
-- 7. Wishlist alert matching (called by the server right after a listing is posted)
------------------------------------------------------------------------------
CREATE FUNCTION app.match_alerts(p_listing uuid)
RETURNS TABLE (alert_id uuid, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT a.id, a.user_id
  FROM app.listings l
  JOIN app.wishlist_alerts a ON a.active
  WHERE l.id = p_listing
    AND NOT l.is_hidden
    AND l.status = 'active'
    AND a.user_id <> l.seller_id
    AND (a.category IS NULL OR a.category = l.category)
    AND (NOT a.free_only OR l.price_type = 'free')
    AND (a.max_price IS NULL OR l.price_type = 'free'
         OR (l.price_type = 'fixed' AND l.price <= a.max_price))
    AND (a.query IS NULL
         OR l.search_vector @@ app.prefix_tsquery(a.query)
         OR (l.isbn IS NOT NULL AND l.isbn = a.query))
    AND NOT app.is_blocked_between(a.user_id, l.seller_id)
    AND NOT EXISTS (
      SELECT 1 FROM app.alert_deliveries d WHERE d.alert_id = a.id AND d.listing_id = l.id
    )
$$;
REVOKE ALL ON FUNCTION app.match_alerts(uuid) FROM PUBLIC, anon, authenticated;

------------------------------------------------------------------------------
-- 8. Storage: one public bucket for listing photos, upload only into your own folder
------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('listing-photos', 'listing-photos', true, 1048576, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "hmd photos: verified users upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND app.is_verified((SELECT auth.uid()))
  );
CREATE POLICY "hmd photos: owners see own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY "hmd photos: owners delete own uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

------------------------------------------------------------------------------
-- 9. Realtime: private broadcast channels, receive-only for clients
------------------------------------------------------------------------------
CREATE POLICY "hmd realtime: join own topics" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND app.can_join_topic((SELECT realtime.topic()))
  );
