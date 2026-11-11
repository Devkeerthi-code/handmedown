-- "Used by N people" must count real students only. Every usage trigger goes through
-- app.track(), so demo accounts (seeded sellers, walkthrough testers) are skipped here, once,
-- instead of in each trigger. Activity already recorded for demo accounts is removed.

CREATE OR REPLACE FUNCTION app.track(e app."UsageEventType", uid uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  INSERT INTO app.usage_events (event, user_id)
  SELECT e, uid
  WHERE NOT EXISTS (SELECT 1 FROM app.profiles p WHERE p.id = uid AND p.is_demo)
$$;
REVOKE ALL ON FUNCTION app.track(app."UsageEventType", uuid) FROM PUBLIC, anon, authenticated;

DELETE FROM app.usage_events e USING app.profiles p WHERE p.id = e.user_id AND p.is_demo;
