# Challenges: setup and testing

## Apply to Supabase once

The app uses real database requests. No hosted migration has been applied by the assistant. Until setup is complete, the Challenges page reports a setup error rather than showing sample records.

1. Open your **Ralli** project in Supabase. In Table Editor, check whether `challenges`, `challenge_participants`, or `challenge_progress` already exist. If any exist, stop and compare their schema first; do not drop them or blindly rerun this migration.
2. Confirm the existing `profiles` table has `id`, `display_name`, and `avatar_path`, and its IDs reference Auth users. Existing Ralli setup already provides these fields.
3. Open **SQL Editor → New query**. Open `supabase/migrations/20261106_challenges.sql` locally, copy the **entire file**, paste it into SQL Editor, and select **Run** once. The file wraps its changes in a transaction. It creates only new challenge tables, indexes, policies, and trigger functions.
4. If an error occurs, run `ROLLBACK;` and inspect the error. Do not delete existing tables to bypass a conflict. Do not rerun the feed, profile, or connections migrations.
5. In Table Editor, confirm RLS is enabled on all three new tables. Check the policies and column grants described below. No buckets, Auth settings, or environment variables need changing.
6. Start the app with `npm run dev` and open `http://localhost:5173/challenges`. Log in, then create your first challenge. If setup was applied while the page was open, click **Retry challenges** or refresh.

The exact SQL is the migration file; there are no extra dashboard changes or RPC functions to configure.

## What is stored and protected

- `challenges`: creator ID, title, description, category, duration, daily goal, and server timestamps. Authenticated users can read challenges. An insert must use the caller's ID. Only the creator can update title, description, category, and daily goal. ID, creator, duration, and creation timestamp are protected by grants and a trigger; `updated_at` is set by the server. No challenge deletion is exposed or granted.
- `challenge_participants`: one unique row per challenge/user. Only that user can insert/delete it. Membership records are readable by signed-in members to support participant counts and the My Challenges filter. Membership is not private; daily progress is.
- `challenge_progress`: one unique record per challenge/user/day. Only the owner can read, insert, or delete their progress. A composite foreign key requires an existing participation record. A trigger rejects days outside the challenge duration. No participant or progress UPDATE privilege exists.
- Anonymous users receive no access to any of the three tables. Existing policies, accounts, posts, profiles, comments, connections, and Storage are unchanged.
- Profile foreign keys lead back to registered Auth users. Account removal by an administrator cascades through owned challenges, participants, and progress. This version has no account or challenge deletion UI.

## Deliberate version-one behavior

**Checklist, not a calendar:** Day 1 means the first activity step, not today's date. Members may complete or undo any day, at their own pace. A challenge is complete when the number of saved, unique completed days equals its duration. Completion and percentage are calculated from database rows, not a second status flag.

**Fixed duration:** Duration is chosen at creation and cannot be edited, even before the first join. This keeps the first version simple and prevents another member's existing progress from becoming invalid. The other four fields remain editable. After the creator-participation migration below, creating a new challenge automatically joins its creator. Creators can still leave and manually rejoin. Existing challenges are never backfilled.

**Leaving:** The confirmation explicitly explains that leaving removes all of the member's saved days. Deleting participation cascades to only that participation's progress. Rejoining starts at zero. Other members' progress remains unchanged.

**Large lists:** Challenges use 12-card pages. A 365-day challenge displays at most 28 day buttons at once. Progress queries read in batches so all saved days count. Search is case-insensitive by title; old search responses cannot replace newer results. My Challenges includes completed challenges until the member leaves.

**Refresh and errors:** Data reloads on navigation and browser refresh. There is no live cross-browser subscription. Buttons disable during saves. A failed membership/progress request may have reached the server even if its response was lost; refresh/reload saved progress before retrying. Creation errors advise checking Created by Me before resubmitting. No success state is shown before a confirmed Supabase response.

## Real-account test checklist

Use two registered accounts, A and B. Do not put credentials into source files.

1. Log in as A. Open Challenges from the header. Create a 2-day challenge with all required fields. Verify its name/avatar, category, goal, duration, and one participant (the creator). Verify it appears in All Challenges and Created by Me, including after refresh.
2. Test blank/space-only fields, oversized text, invalid category, fractional duration, 0, and 366. The UI and database must reject invalid values. Attempt rapid repeat clicks: only one submission should run.
3. As B, search for A's challenge, open details, and follow the creator link to A's public profile. B must not see Edit Challenge. B can join once, see the count increase, and find it under My Challenges. Refresh and verify membership remains.
4. Complete Day 1 as B: expect 1 of 2 and 50%. Refresh, undo it, then complete both days. Expect Challenge Completed! and 100%. My Challenges should display Completed.
5. As A, use your automatic participation to complete a day. B's progress must not appear in A's tracker. A can edit text/category/goal but not duration. B cannot edit A's challenge.
6. As B, click Joined · Leave Challenge and cancel first: progress stays. Confirm next: membership and B's progress disappear, participant count decreases, and My Challenges no longer lists it. Rejoin and verify zero completed days. A's progress remains.
7. Create a 365-day challenge and test Earlier/Later days, including Day 365. Test invalid UUID and nonexistent challenge URLs for Not Found. Test All/My/Created tabs, title search, no matches, Previous/Next, and network-error retry.
8. Test phone (320/390px), tablet (820px), and desktop widths. Use keyboard navigation, check focus outlines, and ensure no horizontal scrolling. Logout and open `/challenges`, `/challenges/new`, and a details URL directly: all must redirect to Login.
9. Verify Home/Explore/Profile navigation, posts, likes/unlikes, comments, profile editing/uploads, and logout still work. Refresh the app to verify actual saved state.

## Database security tests

After migration setup, with two registered profiles, open a **separate SQL Editor query** containing the entire `supabase/tests/challenges_rls.sql` file. Run all of it together. It impersonates authenticated roles inside a transaction and tests ownership, invalid inputs, duplicate joins/days, unjoined progress, day bounds, immutable fields, anonymous denial, progress privacy, undo, and cascade cleanup. It ends in `ROLLBACK` and leaves no test challenge behind. If it errors, run `ROLLBACK;` before investigating. This checks SQL permissions; it is not a browser login test.

## Verification record

Local SQL tests run against an isolated PostgreSQL instance with simulated Supabase Auth/Storage schemas are distinct from hosted Supabase tests. Browser tests with intercepted test responses are also distinct from real-account tests. No mock records are part of the application. Hosted persistence and hosted role behavior must be verified using the steps above after you apply the migration.

Checks completed for this implementation:

- `npm run lint`: passed.
- `npm run build`: passed; Vite still warns that the main JavaScript bundle is over 500 kB (about 529 kB minified).
- New challenge SQL migration and `challenges_rls.sql`: passed in isolated PostgreSQL 16 with simulated Auth/Storage. The existing feed, profile, and connections RLS scripts also passed there.
- Intercepted-response browser tests: passed for two-account create/edit/join flows, duplicate-click prevention, required/length/category/duration validation, participant counts, search and filters, list pagination, refresh, undo, completion, leave/cancel behavior, invalid routes, error/retry UI, 365-day batching and day paging, and logout protection. The actual server responses were mocked; this does not establish hosted persistence.
- Existing feed create/like/unlike/comment browser interactions passed with intercepted responses.
- List, form, and details layouts checked at phone, tablet, and desktop widths (320–1440 px); no horizontal overflow. Screenshots were inspected for desktop details/list and mobile details/form.
- No failing checks remain. Real account signup/login, profile uploads/editing, live connection behavior, and hosted challenge persistence/RLS still need the manual regression checklist. Existing code for those features was not changed.

Reference: Supabase's [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) explains the database policies; the [JavaScript select reference](https://supabase.com/docs/reference/javascript/select) covers the query patterns used here.

## Creator participation update

After the base `20261106_challenges.sql` migration, open a new SQL Editor query, paste the entire `supabase/migrations/20261106_challenge_creator_participation.sql` file, and run it once. Do not rerun the base migration if its tables already exist. If an error occurs, run `ROLLBACK;` and inspect it. This update has not been applied to hosted Supabase by the assistant.

The new AFTER INSERT trigger inserts the creator's participant row inside the challenge creation transaction. It uses SECURITY INVOKER, so the same caller's existing challenge and participant RLS policies apply. A failed participant insert rolls back the challenge too. The unique challenge/user constraint prevents duplicates; the trigger also uses ON CONFLICT DO NOTHING. No policies or grants are weakened, and the trigger function cannot be called directly by API users.

There is no update trigger or historical backfill. Existing challenges, progress, and creators who left are unaffected. After a creator leaves a new challenge, editing or viewing it will not rejoin them. No frontend join-on-load workaround is used. Before this update is applied, creation still has the old behavior; the interface always displays actual saved membership.

Test after applying: create as A, verify 1 participant and immediate progress controls; refresh; join as B and verify 2 participants; leave as A with confirmation and verify B's progress remains; edit as A and refresh to verify A stays unjoined; manually rejoin A and check only one membership. Existing intentionally left challenges must stay unjoined. Run `supabase/tests/challenge_creator_participation.sql` as a single rollback-only SQL Editor script for ownership, RLS enforcement, transaction rollback, and duplicate checks. The script temporarily installs a restrictive test policy inside its rollback-only transaction; use a test project or quiet testing window.

Cards now put the real creator first with a Challenge creator label, compact category/metadata and progress, a primary Continue/Join action, and a smaller Leave action. Leaving retains the existing confirmation and database cleanup. Singular day/participant wording is used for counts of one.

Update verification: creator-participation migration and its rollback-only tests passed against isolated PostgreSQL with simulated Auth/Storage; the existing challenges RLS suite also passed after adjusting its unjoined-user fixture. Mocked browser tests passed for automatic creator membership/progress, refresh, leave confirmation, no rejoin after editing, manual rejoin, singular counts, and card layouts at 320/390/820/1440 px. Lint/build passed (existing bundle-size warning). Hosted Supabase behavior still requires applying the update and testing with real accounts.
