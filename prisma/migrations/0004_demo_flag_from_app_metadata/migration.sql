-- Supabase Auth inserts a user first and writes app_metadata in a later UPDATE, so the INSERT
-- trigger never saw hmd_demo: demo accounts were stored as real people and counted as signups.
-- The trigger now also runs on app_metadata changes, and the demo flag sticks once set
-- (app_metadata is only writable with the secret key, so users can't set it themselves).

CREATE OR REPLACE FUNCTION app.sync_profile_from_auth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  demo_flag boolean := coalesce(NEW.raw_app_meta_data ->> 'hmd_demo', '') = 'true';
  new_college uuid := CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN app.college_for_email(NEW.email) END;
  was_verified boolean;
  was_demo boolean;
  wanted_name text := left(btrim(coalesce(NEW.raw_user_meta_data ->> 'display_name', '')), 40);
BEGIN
  IF char_length(wanted_name) < 2 THEN wanted_name := left(split_part(NEW.email, '@', 1), 40); END IF;
  IF char_length(wanted_name) < 2 THEN wanted_name := 'Student'; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO app.profiles (id, display_name, college_id, verified_at, is_demo)
    VALUES (NEW.id, wanted_name, new_college, CASE WHEN new_college IS NOT NULL THEN now() END, demo_flag)
    ON CONFLICT (id) DO NOTHING;
    IF NOT demo_flag THEN
      PERFORM app.track('signup', NEW.id);
      IF new_college IS NOT NULL THEN PERFORM app.track('verified', NEW.id); END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT p.college_id IS NOT NULL, p.is_demo INTO was_verified, was_demo FROM app.profiles p WHERE p.id = NEW.id;
  IF demo_flag AND NOT coalesce(was_demo, false) THEN
    -- Became a demo account right after creation: undo the signup it was counted as.
    DELETE FROM app.usage_events e WHERE e.user_id = NEW.id;
  END IF;
  UPDATE app.profiles p
     SET college_id = new_college,
         is_demo = p.is_demo OR demo_flag,
         verified_at = CASE WHEN new_college IS NULL THEN NULL
                            WHEN p.college_id IS DISTINCT FROM new_college THEN now()
                            ELSE coalesce(p.verified_at, now()) END
   WHERE p.id = NEW.id;
  IF new_college IS NOT NULL AND NOT coalesce(was_verified, false) AND NOT (demo_flag OR coalesce(was_demo, false)) THEN
    PERFORM app.track('verified', NEW.id);
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email, email_confirmed_at, raw_app_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.sync_profile_from_auth();

-- Repair accounts created before this fix.
UPDATE app.profiles p SET is_demo = true
  FROM auth.users u
 WHERE u.id = p.id AND coalesce(u.raw_app_meta_data ->> 'hmd_demo', '') = 'true' AND NOT p.is_demo;
DELETE FROM app.usage_events e USING app.profiles p WHERE p.id = e.user_id AND p.is_demo;
