-- HandMeDown 0003: multi-college (multi-tenant) platform.
-- Shared database, every tenant-owned row carries college_id, and Row Level Security
-- scopes every read and write by college membership. Earlier migrations are left as-is;
-- functions and policies that change are replaced here.

------------------------------------------------------------------------------
-- 1. Types
------------------------------------------------------------------------------
CREATE TYPE app."CollegeStatus" AS ENUM ('active', 'suspended');
CREATE TYPE app."DomainStatus" AS ENUM ('active', 'pending');
CREATE TYPE app."CollegeRole" AS ENUM ('admin', 'moderator');
ALTER TYPE app."UsageEventType" ADD VALUE IF NOT EXISTS 'college_created';

------------------------------------------------------------------------------
-- 2. Tenant tables
------------------------------------------------------------------------------
CREATE TABLE app.colleges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         varchar(80) NOT NULL,
  short_name   varchar(12) NOT NULL,
  slug         varchar(40) NOT NULL,
  logo_path    varchar(200),
  accent       varchar(7) NOT NULL DEFAULT '#C88042',
  pickup_spots varchar(60)[] NOT NULL,
  categories   app."Category"[] NOT NULL DEFAULT enum_range(NULL::app."Category"),
  status       app."CollegeStatus" NOT NULL DEFAULT 'active',
  is_demo      boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES app.profiles (id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at   timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT colleges_name_len CHECK (char_length(btrim(name)) BETWEEN 3 AND 80),
  CONSTRAINT colleges_short_len CHECK (char_length(btrim(short_name)) BETWEEN 2 AND 12),
  CONSTRAINT colleges_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 3 AND 40),
  CONSTRAINT colleges_accent_hex CHECK (accent ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT colleges_spots_count CHECK (cardinality(pickup_spots) BETWEEN 1 AND 30),
  CONSTRAINT colleges_categories_count CHECK (cardinality(categories) BETWEEN 1 AND 7),
  CONSTRAINT colleges_logo_path CHECK (logo_path IS NULL OR logo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg)$')
);
CREATE UNIQUE INDEX colleges_slug_key ON app.colleges (slug);
CREATE INDEX colleges_status_name_idx ON app.colleges (status, name);

CREATE TABLE app.college_domains (
  domain       varchar(253) PRIMARY KEY,
  college_id   uuid NOT NULL REFERENCES app.colleges (id) ON DELETE CASCADE ON UPDATE CASCADE,
  status       app."DomainStatus" NOT NULL DEFAULT 'pending',
  requested_by uuid,
  created_at   timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT college_domains_format CHECK (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$')
);
CREATE INDEX college_domains_college_id_idx ON app.college_domains (college_id);

CREATE TABLE app.college_roles (
  college_id uuid NOT NULL REFERENCES app.colleges (id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id    uuid NOT NULL REFERENCES app.profiles (id) ON DELETE CASCADE ON UPDATE CASCADE,
  role       app."CollegeRole" NOT NULL,
  granted_by uuid,
  created_at timestamptz(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (college_id, user_id)
);
CREATE INDEX college_roles_user_id_idx ON app.college_roles (user_id);

------------------------------------------------------------------------------
-- 3. Move the existing single-college data into a clearly labelled DEMO college
------------------------------------------------------------------------------
INSERT INTO app.colleges (id, name, short_name, slug, accent, pickup_spots, is_demo)
VALUES (
  '00000000-0000-4000-8000-00000000d001',
  'Demo Institute of Technology (DEMO)',
  'DIT',
  'demo-dit',
  '#C88042',
  ARRAY['Central Library', 'Main Canteen', 'Main Gate', 'Admin Block steps', 'Boys Hostel Block A',
        'Boys Hostel Block B', 'Boys Hostel Block C', 'Girls Hostel lobby', 'Mech Workshop', 'Sports Complex'],
  true
);
INSERT INTO app.college_domains (domain, college_id, status)
VALUES ('demo-dit.example.com', '00000000-0000-4000-8000-00000000d001', 'active');

ALTER TABLE app.profiles ADD COLUMN college_id uuid
  REFERENCES app.colleges (id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX profiles_college_id_idx ON app.profiles (college_id);

ALTER TABLE app.listings ADD COLUMN college_id uuid;
ALTER TABLE app.conversations ADD COLUMN college_id uuid;
ALTER TABLE app.reports ADD COLUMN college_id uuid;
ALTER TABLE app.wishlist_alerts ADD COLUMN college_id uuid;

UPDATE app.listings SET college_id = '00000000-0000-4000-8000-00000000d001';
UPDATE app.conversations SET college_id = '00000000-0000-4000-8000-00000000d001';
UPDATE app.reports SET college_id = '00000000-0000-4000-8000-00000000d001';
UPDATE app.wishlist_alerts SET college_id = '00000000-0000-4000-8000-00000000d001';

ALTER TABLE app.listings ALTER COLUMN college_id SET NOT NULL,
  ADD CONSTRAINT listings_college_id_fkey FOREIGN KEY (college_id) REFERENCES app.colleges (id) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX listings_id_college_id_key ON app.listings (id, college_id);

-- Conversations and listing reports must point at a listing in THEIR college: a composite FK makes
-- a cross-college row impossible to store, whatever the code does.
ALTER TABLE app.conversations DROP CONSTRAINT conversations_listing_id_fkey;
ALTER TABLE app.conversations ALTER COLUMN college_id SET NOT NULL,
  ADD CONSTRAINT conversations_college_id_fkey FOREIGN KEY (college_id) REFERENCES app.colleges (id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT conversations_listing_id_college_id_fkey FOREIGN KEY (listing_id, college_id)
    REFERENCES app.listings (id, college_id) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX conversations_college_id_idx ON app.conversations (college_id);

ALTER TABLE app.reports DROP CONSTRAINT reports_listing_id_fkey;
ALTER TABLE app.reports ALTER COLUMN college_id SET NOT NULL,
  ADD CONSTRAINT reports_college_id_fkey FOREIGN KEY (college_id) REFERENCES app.colleges (id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT reports_listing_id_college_id_fkey FOREIGN KEY (listing_id, college_id)
    REFERENCES app.listings (id, college_id) ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS app.reports_status_created_at_idx;
CREATE INDEX reports_college_id_status_created_at_idx ON app.reports (college_id, status, created_at DESC);

ALTER TABLE app.wishlist_alerts ALTER COLUMN college_id SET NOT NULL,
  ADD CONSTRAINT wishlist_alerts_college_id_fkey FOREIGN KEY (college_id) REFERENCES app.colleges (id) ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS app.wishlist_alerts_active_category_idx;
CREATE INDEX wishlist_alerts_college_id_active_category_idx ON app.wishlist_alerts (college_id, active, category);

-- Feed indexes now lead with the college.
DROP INDEX IF EXISTS app.listings_feed_idx;
DROP INDEX IF EXISTS app.listings_feed_category_idx;
CREATE INDEX listings_feed_idx ON app.listings (college_id, created_at DESC, id DESC)
  WHERE NOT is_hidden AND status <> 'sold';
CREATE INDEX listings_feed_category_idx ON app.listings (college_id, category, created_at DESC, id DESC)
  WHERE NOT is_hidden AND status <> 'sold';

-- Photo paths are now <college_id>/<user_id>/<photo>.webp. NOT VALID keeps any old rows readable.
ALTER TABLE app.listing_photos DROP CONSTRAINT listing_photos_path_format;
ALTER TABLE app.listing_photos ADD CONSTRAINT listing_photos_path_format CHECK (
  storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'
) NOT VALID;

------------------------------------------------------------------------------
-- 4. Membership helpers
------------------------------------------------------------------------------
CREATE FUNCTION app.email_domain(email text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT lower(split_part(coalesce(email, ''), '@', 2)) $$;

-- Free webmail can never identify a college.
CREATE FUNCTION app.is_public_email_domain(d text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT lower(d) = ANY (ARRAY[
    'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.uk', 'live.com',
    'live.in', 'msn.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com', 'icloud.com',
    'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me', 'aol.com', 'zoho.com', 'zohomail.in',
    'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'yandex.ru', 'rediffmail.com', 'tutanota.com', 'tuta.io',
    'fastmail.com', 'hey.com', 'qq.com', '163.com', 'example.org', 'mailinator.com', 'temp-mail.org'
  ])
$$;

-- The college whose ACTIVE domain matches the email (longest match wins, subdomains count).
CREATE FUNCTION app.college_for_email(email text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT d.college_id FROM app.college_domains d
  WHERE d.status = 'active'
    AND (app.email_domain(email) = d.domain OR app.email_domain(email) LIKE '%.' || d.domain)
  ORDER BY char_length(d.domain) DESC
  LIMIT 1
$$;

CREATE FUNCTION app.my_college() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT p.college_id FROM app.profiles p WHERE p.id = auth.uid() AND p.banned_at IS NULL $$;

CREATE FUNCTION app.is_member(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT c IS NOT NULL AND app.my_college() IS NOT DISTINCT FROM c $$;

CREATE FUNCTION app.college_is_active(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM app.colleges WHERE id = c AND status = 'active') $$;

-- Members of an active (not suspended) college may create things in it.
CREATE FUNCTION app.can_write(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT app.is_member(c) AND app.college_is_active(c) $$;

CREATE FUNCTION app.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT coalesce(app.is_admin(auth.uid()), false) $$;

-- A role only counts while you're still a member of that college.
CREATE FUNCTION app.has_college_role(c uuid, roles app."CollegeRole"[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT app.is_member(c) AND EXISTS (
    SELECT 1 FROM app.college_roles r WHERE r.college_id = c AND r.user_id = auth.uid() AND r.role = ANY (roles)
  )
$$;

CREATE FUNCTION app.is_college_admin(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT app.has_college_role(c, ARRAY['admin']::app."CollegeRole"[]) $$;

CREATE FUNCTION app.is_college_staff(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT app.has_college_role(c, ARRAY['admin', 'moderator']::app."CollegeRole"[]) $$;

CREATE FUNCTION app.uuid_or_null(t text) RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT CASE WHEN t ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN t::uuid END
$$;

-- A chat is open to its two participants, and only while they're members of its college.
CREATE FUNCTION app.can_access_conversation(conv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.conversations c
    WHERE c.id = conv AND auth.uid() IN (c.buyer_id, c.seller_id) AND app.is_member(c.college_id)
  )
$$;

-- "Verified" now means "a member of some college".
CREATE OR REPLACE FUNCTION app.is_verified(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.profiles p
    WHERE p.id = uid AND p.college_id IS NOT NULL AND p.banned_at IS NULL
  )
$$;

------------------------------------------------------------------------------
-- 5. Membership comes from the verified Auth email (reuses the existing triggers)
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.sync_profile_from_auth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  is_demo boolean := coalesce(NEW.raw_app_meta_data ->> 'hmd_demo', '') = 'true';
  new_college uuid := CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN app.college_for_email(NEW.email) END;
  was_verified boolean;
  wanted_name text := left(btrim(coalesce(NEW.raw_user_meta_data ->> 'display_name', '')), 40);
BEGIN
  IF char_length(wanted_name) < 2 THEN wanted_name := left(split_part(NEW.email, '@', 1), 40); END IF;
  IF char_length(wanted_name) < 2 THEN wanted_name := 'Student'; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO app.profiles (id, display_name, college_id, verified_at, is_demo)
    VALUES (NEW.id, wanted_name, new_college, CASE WHEN new_college IS NOT NULL THEN now() END, is_demo)
    ON CONFLICT (id) DO NOTHING;
    IF NOT is_demo THEN
      PERFORM app.track('signup', NEW.id);
      IF new_college IS NOT NULL THEN PERFORM app.track('verified', NEW.id); END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT college_id IS NOT NULL INTO was_verified FROM app.profiles WHERE id = NEW.id;
  UPDATE app.profiles
     SET college_id = new_college,
         verified_at = CASE WHEN new_college IS NULL THEN NULL
                            WHEN college_id IS DISTINCT FROM new_college THEN now()
                            ELSE coalesce(verified_at, now()) END
   WHERE id = NEW.id;
  IF new_college IS NOT NULL AND NOT coalesce(was_verified, false) AND NOT is_demo THEN
    PERFORM app.track('verified', NEW.id);
  END IF;
  RETURN NEW;
END
$$;

-- Re-derives college membership from Auth emails: for one domain, or everyone when p_domain is NULL.
CREATE FUNCTION app.recompute_memberships(p_domain text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  WITH target AS (
    SELECT u.id,
           CASE WHEN u.email_confirmed_at IS NOT NULL THEN app.college_for_email(u.email) END AS cid
    FROM auth.users u
    WHERE p_domain IS NULL
       OR app.email_domain(u.email) = p_domain
       OR app.email_domain(u.email) LIKE '%.' || p_domain
  )
  UPDATE app.profiles p
     SET college_id = t.cid,
         verified_at = CASE WHEN t.cid IS NULL THEN NULL ELSE coalesce(p.verified_at, now()) END
    FROM target t
   WHERE t.id = p.id AND p.college_id IS DISTINCT FROM t.cid;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END
$$;
REVOKE ALL ON FUNCTION app.recompute_memberships(text) FROM PUBLIC, anon, authenticated;

-- Kept for scripts/sync-config.ts (same name as before, now college-aware).
CREATE OR REPLACE FUNCTION app.recompute_verification() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT app.recompute_memberships(NULL) $$;
REVOKE ALL ON FUNCTION app.recompute_verification() FROM PUBLIC, anon, authenticated;

-- Leaving a college (email change) ends your staff roles there.
CREATE FUNCTION app.after_profile_college_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  DELETE FROM app.college_roles WHERE user_id = NEW.id AND college_id IS DISTINCT FROM NEW.college_id;
  RETURN NEW;
END
$$;
CREATE TRIGGER profiles_college_changed AFTER UPDATE OF college_id ON app.profiles
  FOR EACH ROW WHEN (OLD.college_id IS DISTINCT FROM NEW.college_id)
  EXECUTE FUNCTION app.after_profile_college_change();

DROP FUNCTION IF EXISTS app.email_domain_allowed(text);
DROP TABLE app.allowed_domains;

------------------------------------------------------------------------------
-- 6. College lifecycle: creation, domains, guards
------------------------------------------------------------------------------
-- The only way to create a college. The caller's confirmed email domain becomes its first
-- (active) domain and the caller its first admin. No extra email: the Auth confirmation already proved the inbox.
CREATE FUNCTION app.create_college(
  p_name text, p_short text, p_slug text, p_accent text, p_spots text[], p_categories app."Category"[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  u record;
  dom text;
  recent integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'NOT_SIGNED_IN' USING ERRCODE = '42501'; END IF;
  SELECT email, email_confirmed_at INTO u FROM auth.users WHERE id = uid;
  IF u.email_confirmed_at IS NULL THEN RAISE EXCEPTION 'EMAIL_NOT_VERIFIED' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM app.profiles WHERE id = uid AND banned_at IS NOT NULL) THEN
    RAISE EXCEPTION 'BANNED' USING ERRCODE = '42501';
  END IF;
  dom := app.email_domain(u.email);
  IF app.is_public_email_domain(dom) THEN RAISE EXCEPTION 'PUBLIC_DOMAIN' USING ERRCODE = 'P0001'; END IF;
  IF EXISTS (SELECT 1 FROM app.college_domains d WHERE d.domain = dom OR dom LIKE '%.' || d.domain) THEN
    RAISE EXCEPTION 'DOMAIN_TAKEN' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO recent FROM app.colleges WHERE created_by = uid AND created_at > now() - interval '1 day';
  IF recent >= 2 THEN RAISE EXCEPTION 'RATE_LIMIT:colleges' USING ERRCODE = 'P0001'; END IF;
  SELECT count(*) INTO recent FROM app.colleges WHERE created_at > now() - interval '1 hour';
  IF recent >= 30 THEN RAISE EXCEPTION 'RATE_LIMIT:colleges' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO app.colleges (name, short_name, slug, accent, pickup_spots, categories, created_by)
  VALUES (btrim(p_name), btrim(p_short), lower(p_slug), upper(p_accent), p_spots, p_categories, uid)
  RETURNING id INTO new_id;
  INSERT INTO app.college_domains (domain, college_id, status, requested_by) VALUES (dom, new_id, 'active', uid);
  -- The domain trigger has just made everyone on this domain (including the caller) a member.
  INSERT INTO app.college_roles (college_id, user_id, role, granted_by) VALUES (new_id, uid, 'admin', uid);
  PERFORM app.track('college_created', uid);
  RETURN new_id;
END
$$;
REVOKE ALL ON FUNCTION app.create_college(text, text, text, text, text[], app."Category"[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.create_college(text, text, text, text, text[], app."Category"[]) TO authenticated;

-- Domain changes immediately re-derive who belongs where.
CREATE FUNCTION app.after_domain_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM app.recompute_memberships(OLD.domain);
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    PERFORM app.recompute_memberships(NEW.domain);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM app.recompute_memberships(NEW.domain);
  END IF;
  RETURN NULL;
END
$$;
CREATE TRIGGER college_domains_changed AFTER INSERT OR UPDATE OR DELETE ON app.college_domains
  FOR EACH ROW EXECUTE FUNCTION app.after_domain_change();

-- Extra domains requested by a college admin start pending; only the platform admin activates them.
CREATE FUNCTION app.guard_college_domain() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  pending integer;
BEGIN
  NEW.domain := lower(btrim(NEW.domain));
  IF app.is_public_email_domain(NEW.domain) THEN RAISE EXCEPTION 'PUBLIC_DOMAIN' USING ERRCODE = 'P0001'; END IF;
  IF auth.uid() IS NULL OR app.is_platform_admin() THEN RETURN NEW; END IF;
  -- create_college(): the founding domain of a college you created, which has no domains yet, starts active.
  IF TG_OP = 'INSERT' AND NEW.status = 'active'
     AND EXISTS (SELECT 1 FROM app.colleges c WHERE c.id = NEW.college_id AND c.created_by = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM app.college_domains d WHERE d.college_id = NEW.college_id) THEN
    NEW.requested_by := auth.uid();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.domain <> OLD.domain OR NEW.college_id <> OLD.college_id) THEN
    RAISE EXCEPTION 'Only the platform admin can approve or move domains' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM app.college_domains d WHERE NEW.domain LIKE '%.' || d.domain OR d.domain LIKE '%.' || NEW.domain) THEN
      RAISE EXCEPTION 'DOMAIN_TAKEN' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO pending FROM app.college_domains WHERE college_id = NEW.college_id AND status = 'pending';
    IF pending >= 5 THEN RAISE EXCEPTION 'RATE_LIMIT:domains' USING ERRCODE = 'P0001'; END IF;
    NEW.status := 'pending';
    NEW.requested_by := auth.uid();
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER college_domains_guard BEFORE INSERT OR UPDATE ON app.college_domains
  FOR EACH ROW EXECUTE FUNCTION app.guard_college_domain();

-- College admins edit branding; only the platform admin suspends; slug and ownership never change.
CREATE FUNCTION app.guard_college_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR app.is_platform_admin() THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only the platform admin can suspend or reactivate a college' USING ERRCODE = '42501';
  END IF;
  IF NEW.slug <> OLD.slug OR NEW.is_demo <> OLD.is_demo OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'That field can''t be changed' USING ERRCODE = '42501';
  END IF;
  NEW.accent := upper(NEW.accent);
  RETURN NEW;
END
$$;
CREATE TRIGGER colleges_guard_update BEFORE UPDATE ON app.colleges
  FOR EACH ROW EXECUTE FUNCTION app.guard_college_update();

-- Listings must use their college's categories and pickup spots, and never move college.
CREATE FUNCTION app.check_listing_college() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  c record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.college_id <> OLD.college_id THEN
    RAISE EXCEPTION 'A listing can''t move to another college' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.category IS DISTINCT FROM OLD.category OR NEW.pickup_spot IS DISTINCT FROM OLD.pickup_spot THEN
    SELECT categories, pickup_spots INTO c FROM app.colleges WHERE id = NEW.college_id;
    IF NOT (NEW.category = ANY (c.categories)) THEN
      RAISE EXCEPTION 'CATEGORY_NOT_ENABLED' USING ERRCODE = '23514';
    END IF;
    IF NOT (NEW.pickup_spot = ANY (c.pickup_spots::text[])) THEN
      RAISE EXCEPTION 'UNKNOWN_PICKUP_SPOT' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER listings_check_college BEFORE INSERT OR UPDATE ON app.listings
  FOR EACH ROW EXECUTE FUNCTION app.check_listing_college();

-- Buyer, seller and listing of a conversation must all be in the conversation's college.
CREATE FUNCTION app.check_conversation_college() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app.listings l WHERE l.id = NEW.listing_id AND l.college_id = NEW.college_id AND l.seller_id = NEW.seller_id) THEN
    RAISE EXCEPTION 'CROSS_COLLEGE' USING ERRCODE = '23514';
  END IF;
  IF (SELECT count(*) FROM app.profiles p WHERE p.id IN (NEW.buyer_id, NEW.seller_id) AND p.college_id = NEW.college_id) <> 2 THEN
    RAISE EXCEPTION 'CROSS_COLLEGE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER conversations_check_college BEFORE INSERT ON app.conversations
  FOR EACH ROW EXECUTE FUNCTION app.check_conversation_college();

-- Reports belong to the college of what's reported.
CREATE FUNCTION app.check_report_college() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.reported_user_id IS NOT NULL AND NEW.listing_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM app.profiles p WHERE p.id = NEW.reported_user_id AND p.college_id = NEW.college_id) THEN
    RAISE EXCEPTION 'CROSS_COLLEGE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER reports_check_college BEFORE INSERT ON app.reports
  FOR EACH ROW EXECUTE FUNCTION app.check_report_college();

-- Only college staff (of that college) or the platform admin may un-hide a reported listing.
CREATE OR REPLACE FUNCTION app.guard_listing_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.is_hidden AND NOT NEW.is_hidden
     AND NOT (app.is_college_staff(NEW.college_id) OR app.is_platform_admin()) THEN
    RAISE EXCEPTION 'Only an admin can restore a hidden listing' USING ERRCODE = '42501';
  END IF;
  IF NEW.status = 'sold' AND OLD.status <> 'sold' THEN
    PERFORM app.track('listing_sold', NEW.seller_id);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

------------------------------------------------------------------------------
-- 7. Privileges for the new tables
------------------------------------------------------------------------------
GRANT SELECT ON app.colleges, app.college_domains TO anon, authenticated;
GRANT UPDATE (name, short_name, logo_path, accent, pickup_spots, categories, status) ON app.colleges TO authenticated;
GRANT INSERT (domain, college_id), DELETE ON app.college_domains TO authenticated;
GRANT UPDATE (status) ON app.college_domains TO authenticated;
GRANT SELECT, INSERT, DELETE ON app.college_roles TO authenticated;
GRANT EXECUTE ON FUNCTION app.email_domain(text), app.is_public_email_domain(text), app.my_college(),
  app.is_member(uuid), app.college_is_active(uuid), app.can_write(uuid), app.is_platform_admin(),
  app.has_college_role(uuid, app."CollegeRole"[]), app.is_college_admin(uuid), app.is_college_staff(uuid),
  app.uuid_or_null(text), app.can_access_conversation(uuid), app.college_for_email(text)
  TO anon, authenticated;

ALTER TABLE app.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.college_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.college_roles ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------------
-- 8. Row Level Security, now scoped by college
------------------------------------------------------------------------------
-- colleges: public directory; branding by that college's admins while active; anything by the platform admin
CREATE POLICY colleges_read ON app.colleges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY colleges_update ON app.colleges FOR UPDATE TO authenticated
  USING ((app.is_college_admin(id) AND status = 'active') OR app.is_platform_admin())
  WITH CHECK (app.is_college_admin(id) OR app.is_platform_admin());

CREATE POLICY college_domains_read ON app.college_domains FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY college_domains_insert ON app.college_domains FOR INSERT TO authenticated
  WITH CHECK ((app.is_college_admin(college_id) AND app.college_is_active(college_id)) OR app.is_platform_admin());
CREATE POLICY college_domains_update ON app.college_domains FOR UPDATE TO authenticated
  USING (app.is_platform_admin()) WITH CHECK (app.is_platform_admin());
CREATE POLICY college_domains_delete ON app.college_domains FOR DELETE TO authenticated
  USING ((app.is_college_admin(college_id) AND status = 'pending') OR app.is_platform_admin());

CREATE POLICY college_roles_read ON app.college_roles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR app.is_college_staff(college_id) OR app.is_platform_admin());
CREATE POLICY college_roles_insert ON app.college_roles FOR INSERT TO authenticated
  WITH CHECK (
    (app.is_college_admin(college_id) AND app.college_is_active(college_id)
      AND EXISTS (SELECT 1 FROM app.profiles p WHERE p.id = user_id AND p.college_id = college_roles.college_id AND p.banned_at IS NULL))
    OR app.is_platform_admin()
  );
CREATE POLICY college_roles_delete ON app.college_roles FOR DELETE TO authenticated
  USING ((app.is_college_admin(college_id) AND user_id <> (SELECT auth.uid())) OR app.is_platform_admin());

-- listings
DROP POLICY listings_read ON app.listings;
DROP POLICY listings_insert_verified_owner ON app.listings;
DROP POLICY listings_update_owner_or_admin ON app.listings;
DROP POLICY listings_delete_owner_or_admin ON app.listings;

CREATE POLICY listings_read ON app.listings FOR SELECT TO anon, authenticated
  USING (
    NOT is_hidden
    OR seller_id = (SELECT auth.uid())
    OR app.is_college_staff(college_id)
    OR app.is_platform_admin()
  );
CREATE POLICY listings_insert_member ON app.listings FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = (SELECT auth.uid())
    AND app.can_write(college_id)
    AND NOT is_hidden AND NOT is_demo AND status = 'active'
  );
CREATE POLICY listings_update ON app.listings FOR UPDATE TO authenticated
  USING (
    (seller_id = (SELECT auth.uid()) AND app.can_write(college_id))
    OR (app.is_college_staff(college_id) AND app.college_is_active(college_id))
    OR app.is_platform_admin()
  )
  WITH CHECK (
    (seller_id = (SELECT auth.uid()) AND app.can_write(college_id))
    OR (app.is_college_staff(college_id) AND app.college_is_active(college_id))
    OR app.is_platform_admin()
  );
CREATE POLICY listings_delete ON app.listings FOR DELETE TO authenticated
  USING (
    (seller_id = (SELECT auth.uid()) AND app.can_write(college_id))
    OR (app.is_college_staff(college_id) AND app.college_is_active(college_id))
    OR app.is_platform_admin()
  );

-- photos: owner only, stored under <listing's college>/<owner>/
DROP POLICY photos_insert_owner ON app.listing_photos;
DROP POLICY photos_delete_owner ON app.listing_photos;
CREATE POLICY photos_insert_owner ON app.listing_photos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.listings l
      WHERE l.id = listing_id AND l.seller_id = (SELECT auth.uid()) AND app.can_write(l.college_id)
        AND split_part(storage_path, '/', 1) = l.college_id::text
        AND split_part(storage_path, '/', 2) = (SELECT auth.uid())::text
    )
  );
CREATE POLICY photos_delete_owner ON app.listing_photos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM app.listings l WHERE l.id = listing_id AND l.seller_id = (SELECT auth.uid()) AND app.can_write(l.college_id)
  ));

-- conversations and messages: participants who are members of that college
DROP POLICY conversations_read_participants ON app.conversations;
DROP POLICY conversations_insert_buyer ON app.conversations;
CREATE POLICY conversations_read ON app.conversations FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (buyer_id, seller_id) AND app.is_member(college_id));
CREATE POLICY conversations_insert ON app.conversations FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = (SELECT auth.uid())
    AND app.can_write(college_id)
    AND NOT app.is_blocked_between(buyer_id, seller_id)
    AND EXISTS (
      SELECT 1 FROM app.listings l
      WHERE l.id = listing_id AND l.college_id = conversations.college_id AND l.seller_id = conversations.seller_id
        AND NOT l.is_hidden AND l.status <> 'sold'
    )
  );

DROP POLICY messages_read_participants ON app.messages;
DROP POLICY messages_insert_participant ON app.messages;
CREATE POLICY messages_read ON app.messages FOR SELECT TO authenticated
  USING (app.can_access_conversation(conversation_id));
CREATE POLICY messages_insert ON app.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND app.can_access_conversation(conversation_id)
    AND NOT app.conversation_is_blocked(conversation_id)
    AND EXISTS (SELECT 1 FROM app.conversations c WHERE c.id = conversation_id AND app.college_is_active(c.college_id))
  );

DROP POLICY reads_own ON app.conversation_reads;
CREATE POLICY reads_own ON app.conversation_reads FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) AND app.can_access_conversation(conversation_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND app.can_access_conversation(conversation_id));

-- reports: filed by members, seen by the reporter, that college's staff and the platform admin
DROP POLICY reports_insert_own ON app.reports;
DROP POLICY reports_read_own_or_admin ON app.reports;
DROP POLICY reports_update_admin ON app.reports;
CREATE POLICY reports_insert ON app.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()) AND app.can_write(college_id) AND status = 'open' AND resolved_by IS NULL);
CREATE POLICY reports_read ON app.reports FOR SELECT TO authenticated
  USING (
    (reporter_id = (SELECT auth.uid()) AND app.is_member(college_id))
    OR app.is_college_staff(college_id)
    OR app.is_platform_admin()
  );
CREATE POLICY reports_update ON app.reports FOR UPDATE TO authenticated
  USING ((app.is_college_staff(college_id) AND app.college_is_active(college_id)) OR app.is_platform_admin())
  WITH CHECK ((app.is_college_staff(college_id) AND app.college_is_active(college_id)) OR app.is_platform_admin());

-- wishlist alerts: yours, in your college
DROP POLICY alerts_own ON app.wishlist_alerts;
CREATE POLICY alerts_read ON app.wishlist_alerts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) AND app.is_member(college_id));
CREATE POLICY alerts_insert ON app.wishlist_alerts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND app.can_write(college_id));
CREATE POLICY alerts_update ON app.wishlist_alerts FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND app.can_write(college_id))
  WITH CHECK (user_id = (SELECT auth.uid()) AND app.can_write(college_id));
CREATE POLICY alerts_delete ON app.wishlist_alerts FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

------------------------------------------------------------------------------
-- 9. Rate limits, realtime and alert matching respect colleges
------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.can_join_topic(topic text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR topic IS NULL THEN RETURN false; END IF;
  IF topic LIKE 'conversation:%' THEN
    RETURN coalesce(app.can_access_conversation(app.uuid_or_null(substr(topic, 14))), false);
  ELSIF topic LIKE 'user:%' THEN
    RETURN substr(topic, 6) = uid::text;
  END IF;
  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION app.match_alerts(p_listing uuid)
RETURNS TABLE (alert_id uuid, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT a.id, a.user_id
  FROM app.listings l
  JOIN app.wishlist_alerts a ON a.active AND a.college_id = l.college_id
  JOIN app.profiles p ON p.id = a.user_id AND p.college_id = l.college_id AND p.banned_at IS NULL
  WHERE l.id = p_listing
    AND NOT l.is_hidden
    AND l.status = 'active'
    AND app.college_is_active(l.college_id)
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
-- 10. Storage: photos under <college>/<user>/, logos under <college>/ (college admins)
------------------------------------------------------------------------------
DROP POLICY "hmd photos: verified users upload to own folder" ON storage.objects;
DROP POLICY "hmd photos: owners see own uploads" ON storage.objects;
DROP POLICY "hmd photos: owners delete own uploads" ON storage.objects;

CREATE POLICY "hmd photos: members upload to their college folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND (storage.foldername(name))[1] = app.my_college()::text
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    AND app.can_write(app.my_college())
  );
CREATE POLICY "hmd photos: owners see own uploads" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);
CREATE POLICY "hmd photos: owners delete own uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[2] = (SELECT auth.uid())::text);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('college-logos', 'college-logos', true, 1048576, ARRAY['image/webp', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "hmd logos: college admins upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'college-logos'
    AND (app.is_college_admin(app.uuid_or_null((storage.foldername(name))[1])) OR app.is_platform_admin())
  );
CREATE POLICY "hmd logos: college admins see" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'college-logos'
    AND (app.is_college_admin(app.uuid_or_null((storage.foldername(name))[1])) OR app.is_platform_admin())
  );
CREATE POLICY "hmd logos: college admins delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'college-logos'
    AND (app.is_college_admin(app.uuid_or_null((storage.foldername(name))[1])) OR app.is_platform_admin())
  );

------------------------------------------------------------------------------
-- 11. Re-derive memberships for everyone (domains moved from allowed_domains to colleges)
------------------------------------------------------------------------------
SELECT app.recompute_memberships(NULL);
