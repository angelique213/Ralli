# Explore and Connect setup

The code uses real Supabase profiles, posts and connections. No hosted migration has been applied by the assistant. The read-only schema check found the expected profile columns and returned PGRST205 for connections (not exposed in the REST schema).

## Apply once in Supabase

1. Open Table Editor and confirm there is no existing `public.connections` table. If there is one, inspect its schema instead of running a duplicate migration or dropping it.
2. Open SQL Editor > New query. Copy the entire file `supabase/migrations/20261030_connections.sql` and Run once. It assumes the existing `profiles` table. Do not rerun the feed or profile customization migrations.
3. Verify `connections` has RLS enabled, both foreign keys, the unique pair constraint, self-connection check, and its three policies. Only SELECT, INSERT of the two user IDs, and DELETE are granted to authenticated users. There is no UPDATE permission. Both foreign keys reference profiles, whose IDs reference Auth users, with deletion cascading to relationships.
4. Refresh the app. Connect buttons and connection counts will read the new table. Before setup, they display a database-setup error and retry control rather than fake counts or successful connections.
5. If SQL fails, run `ROLLBACK;` and inspect the error. Do not drop or alter existing tables to bypass an error.

Privacy: existing profile read policies are unchanged. Public profile queries explicitly select only ID, display name, bio, avatar/cover paths, and profile creation time. Another member's email is never queried from Auth or displayed. Connections are readable by signed-in members so public counts and lists work; logged-out users receive no connections-table access. Graph relationships are not private to their owner. Only the follower can insert/delete an outgoing relationship. The UI hides account editing on other profiles; existing profile RLS still enforces write ownership.

## Manual browser checks with two real accounts

1. Login as A, open Explore, and search B's display name (including different capitalization). Press Enter, type rapidly, clear the search, and test a name that does not exist. A must not appear in discovery results.
2. Click B's name/photo/View Profile. Confirm `/profile/<B UUID>`, B's name, bio, photos, posts, and counts. B's email and upload/edit controls must not appear. Try Posts/About and the full photo viewer.
3. Connect to B. Wait for Connected and verify Connected By increments on B's page. Refresh: Connected must remain. Click Connected to disconnect and refresh again.
4. Click Connections and Connected By counts. Inspect the correct list, page through larger lists, open member profiles, and use Connect/Connected there. Check both counts after changing relationships. Self cards have no Connect button.
5. Create a post as B. As A, view B's profile and like/unlike and comment. Refresh to verify saved activity. Post and comment author names/avatars must navigate to the correct profile. Opening your own UUID URL redirects to `/profile`.
6. Log in as B: A connecting to B must not imply B connecting to A. B sees A in Connected By, not automatically in Connections.
7. Open `/profile/not-a-uuid` and a valid unused UUID: expect Profile not found. Test browser Back/Forward between Home, Explore, and multiple profiles.
8. Log out and directly open `/explore` and `/profile/<B UUID>`: expect Login, including after refresh and Back. Check own-profile edits and uploads still persist.
9. Test 1440px desktop, 820px tablet and 390/320px mobile. Test keyboard links/buttons. Briefly disable networking: errors must show and retry must recover. If a save response is lost, Retry connection reads the server state before another write.

## Database tests

With two registered accounts, run all of `supabase/tests/connections_rls.sql` in SQL Editor. It temporarily tests the pair, duplicates, self-connect, impersonation, update denial, other-user deletion denial, owner deletion and anonymous write denial, then rolls back. If it errors, run `ROLLBACK;`. Run the existing feed/profile RLS tests separately for regression checks. No service-role key belongs in frontend code.

## Implementation notes

Search and lists use 20-member pages with one extra row to detect Next. Search is case-insensitive and delays typing requests by 250ms; late responses are ignored. Confirmed connection changes refresh visible counts, lists, and buttons. Data is fetched again when navigating or refreshing; this is not a live subscription to changes from other browsers. A connected relationship is one-way. Supabase unique constraints prevent duplicates across tabs. App state is only a display copy of saved records.

Lint/build and mocked browser tests are not proof of hosted persistence. Complete the real-account tests after applying the migration. The assistant does not have account passwords or administrative credentials.

Verification completed locally: the new migration and connection RLS tests passed in isolated PostgreSQL 16 with simulated Auth/Storage tables; existing feed and profile RLS tests also passed. Mocked browser tests passed for case-insensitive search, Enter, stale-response handling, empty/error/retry states, 20-member pagination, public-profile privacy, not-found routes, own-profile redirects, Connect/Disconnect and refresh, live count/list updates after writes, one-way relationships, author links, Back/Forward, logout protection, and responsive widths from 320 to 1440px. Existing upload/editor/viewer/avatar/feed interaction regression tests also passed with test responses. Real Supabase authenticated writes and persistence remain unverified until setup and real-account tests. Lint passes; build passes with the existing JavaScript bundle-size warning.
