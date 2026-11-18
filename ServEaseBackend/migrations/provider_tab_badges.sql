-- Mobile provider app: unread badges on the Requests and Jobs tabs.
-- notifications.tab_seen_at is set when the provider opens that tab. It is separate from
-- seen_at (the bell badge) and read_at, so the three never clear each other.
-- Run once in the Supabase SQL editor.

alter table notifications add column if not exists tab_seen_at timestamptz;

-- Everything that exists today counts as already seen, so providers don't open the app to a
-- huge badge made of old notifications.
update notifications set tab_seen_at = now() where tab_seen_at is null;