# FR-11: Private text messaging

## Database setup (manual, not performed by this implementation)

1. Prefer a separate Supabase test project with the existing Ralli migrations applied.
2. Review `supabase/migrations/20261119_private_messages.sql` in full.
3. In the intended Supabase project, open **SQL Editor → New query**.
4. Paste the entire migration, including BEGIN and COMMIT, and run it once.
5. If it errors, run `ROLLBACK;`, inspect the error, and do not drop existing tables to force it through.
6. Confirm `public.messages` has RLS enabled, participant-only SELECT and sender-only INSERT policies, and no client UPDATE/DELETE grants.
7. No Storage bucket, Realtime publication, secret key, or environment variable change is needed.
8. Restart the local app with `npm run dev` if necessary and open Messages.

This migration creates only a new messages table, its indexes/policies, and an inbox function. It does not alter existing tables/policies. The inbox function is SECURITY INVOKER: the caller's RLS still applies. Messages cascade away if either member's profile/account is deleted. This version does not allow message edits or deletion through the client.

## Test with real accounts

1. Sign in as A in a normal browser and B in a separate browser/private window.
2. A: open Messages, search B's display name, and select B. Alternatively use Message on B's public profile.
3. Send a text message. Confirm delivery, timestamp, and the cleared input.
4. B: open Messages. Within roughly five seconds the conversation appears. Open it and reply.
5. Refresh both browsers and reopen the route: history should persist.
6. Test whitespace-only text, long text, fast repeated clicks, and interrupted networking. After an uncertain send, retry with unchanged text; the same UUID is used to avoid duplicates. Changing text starts a new send attempt.
7. Create more than 50 messages on the test project to test Load older messages. The latest window expands by 50; polling preserves this expanded window. This intentionally simple approach can become expensive for very long histories and can later be replaced with cursor pagination.
8. Test invalid/nonexistent member links, empty search results, and logout/Back. Account changes must not retain another account's conversation UI.
9. Check 320px, 375px, tablet, and desktop widths: navigation, member search, long message wrapping, and keyboard focus.
10. Smoke-test existing posts, comments, likes, profile edits/uploads, Explore/connections, Challenges, and login/logout.

## Authorization tests

Use THREE registered accounts in a test Supabase project. Run all of `supabase/tests/messages_rls.sql` as one script in SQL Editor after the migration. It switches into authenticated/anonymous database roles and rolls back test writes. If it fails, run `ROLLBACK;` and investigate. It covers sender/recipient access, third-party isolation, spoofing, no edits/deletes, whitespace/length constraints, and anonymous denial.

Also test direct API requests as C: retrieving A–B messages must return no rows; supplying another sender, editing, or deleting must fail. Never test this using a service-role key, which bypasses normal user authorization.

## Automated checks and limitations

Run `npm run lint`, `npm run build`, and `node --test tests/*.test.mjs`.
The Node service tests use a fake Supabase client. They test validation, query filters, paging, allowed insert columns, failures, and duplicate retry confirmation; they do not prove live RLS or persistence. SQL tests and two-browser tests require a real configured test database and were not executed automatically.

Polling runs every five seconds only while the messaging page is visible, refreshes on visibility changes, and stops when unmounted. There are no read receipts, notifications, attachments, typing indicators, or browser-stored message caches. Private means restricted to the two members through RLS, not end-to-end encrypted; database administrators can read stored content. Blocking and server-side rate limits are not part of this version, so abuse/spam remains a limitation.

## Unsend for everyone

Review `supabase/migrations/20261120_unsend_messages.sql` AFTER the original messaging migration. Before applying, inspect `messages_body_check` in Supabase's table definition and verify it is the original 1–2000 character/non-whitespace check. The new migration stops if that expected name is missing; if its definition has been customized, stop and review rather than replace it blindly. Paste the entire new migration into a new SQL Editor query and run once, preferably in a test project first. No migration was run automatically. The updated frontend requires the new column.

The migration keeps normal client UPDATE/DELETE denied. A narrowly scoped SECURITY DEFINER function checks auth.uid() against the original sender, locks that row, removes body by setting it to NULL, and records unsent_at. Only authenticated clients can execute it. Existing read and insert policies are unchanged. Retries retain the original unsent timestamp. Message IDs, participants, timestamps, and inbox ordering stay intact. A constraint permits only valid normal text or a NULL body with an unsent timestamp.

Test A → B in two browsers: send text, open A's three-dot menu, cancel once, then confirm Unsend for everyone. A should immediately see the placeholder; B sees it after the next successful visible-page poll (about five seconds). Refresh both browsers. Verify the stored body is NULL. B must never have an unsend control for A's message. Test keyboard Tab/Enter/Escape, narrow mobile widths, interrupted networking, and repeat retries. Existing sending, searching, and history must continue working. Run `supabase/tests/message_unsend_rls.sql` in a TEST project with three registered accounts to check recipient/third-party/anonymous rejection and direct-edit restrictions. Run the original messaging SQL tests too. These SQL and browser tests were not executed automatically.

The client remembers confirmed/observed unsent IDs only in memory so stale polling responses cannot restore text. No private content is stored in localStorage. Already delivered text, screenshots, old database row versions/WAL, or backups cannot be recalled by this operation. It removes the body from the current stored record and future normal API reads, not every historical copy. Sending a duplicate ID that has already been unsent is rejected rather than resending the old text.

## Delete for Me / Delete Conversation

Review and manually apply `supabase/migrations/20261121_message_visibility.sql` after both earlier messaging migrations, preferably in a test project first. Paste the whole file into SQL Editor and run once. It adds two RLS-protected visibility tables, two authenticated-only SECURITY DEFINER functions, and a restrictive message SELECT policy. It does not grant UPDATE/DELETE on messages or change their contents. Previous migrations remain unchanged. The invoker inbox automatically respects the new policy.

Delete for me is available on received/sent messages and unsent placeholders. Delete conversation is in the chat header. Confirmations describe the local-only effect. After confirmation the inbox refreshes; conversation deletion returns to the list. Search can still find the member but cannot restore hidden history. New messages from either participant reopen the conversation. A conversation deletion hides all messages visible to its SQL statement snapshot, including unloaded pages; a concurrent send committed after that snapshot stays visible. Hidden rows persist across refresh/login. There is no undo UI.

Each conversation deletion retains a UUID in the open action component across failed retries, including closing/reopening its dialog. Its database receipt prevents replaying that UUID from hiding later arrivals. Navigating away or refreshing loses that in-memory token: check the refreshed state before initiating a NEW deletion, which intentionally hides current messages. Request records must not be purged casually, or old retries could run again. This simple design writes one hide row per message and can become expensive for very large histories.

Manual tests: sign in as A and B in separate browsers. Hide A's message as A and verify B still sees it; hide a received message as B and verify A is unaffected. Repeat for unsent placeholders. Delete A's conversation and verify B keeps their visible history. Refresh/login again as A, then send a new message from B: A sees only new visible messages. Test more than 50 messages, Load older messages, Search, offline failures, unchanged retry tokens, keyboard Tab/Enter/Escape, and 320px/375px/mobile/desktop views. Test a simultaneous send during deletion. Run `supabase/tests/message_visibility_rls.sql` on a test project with 3 accounts; run the earlier SQL tests as regression checks. None of these SQL scripts were run automatically.

Node tests use mocked services and verify RPC payloads, confirmation handling, retry token reuse, stale-response filtering, and interaction with unsend. They do not prove hosted RLS or real two-account persistence. No messages or visibility records are stored in localStorage. After Delete for Me, Unsend is no longer reachable from that hidden bubble; existing sender-only Unsend authorization remains intact.

## Pending deletion recovery (client-only update)

Conversation deletion now writes only `{userId, otherUserId, requestId, createdAt}` to localStorage before sending. No body, name, email, or history is saved. The account/pair-scoped record is retained after uncertain results, refresh, navigation, and logout. Messages displays **Retry pending deletion** for the signed-in account. Successful matching server confirmation is required before cleanup. If cleanup fails, the same receipt can safely be retried. Corrupt/unavailable storage blocks deletion rather than inventing a replacement request.

Web Locks coordinate attempts across tabs (HTTPS or localhost required). Competing requests fail instead of queuing; storage events update recovery notices and open dialogs. Unsupported browsers fail closed with an explanation. The authenticated account is reverified before sending. Other accounts never list or process the pending record. IDs still constitute limited relationship metadata; clearing site storage/private-browsing cleanup or using another device loses recovery information.

Test: interrupt networking during deletion, refresh, restore networking, then use Retry pending deletion. Verify the original request UUID is reused. If the first request committed, messages received afterward survive replay; if it never reached the server, retry performs its first deletion against then-current history. Test two tabs attempting deletion, another account logging in, blocked localStorage, and keyboard activation of retry. Node tests simulate storage, locks, account verification, and network responses; they do not perform real browser or Supabase tests. This section supersedes the earlier React-ref-only recovery limitation. No new SQL is required.

## Linked replies

Review `supabase/migrations/20261122_linked_replies.sql` before applying it manually
in Supabase SQL Editor, after the three earlier messaging migrations. Run the
complete transaction once. No existing message text is rewritten. The new nullable
reference, index, insert-only column permission, and SECURITY INVOKER validation
trigger preserve existing RLS and do not grant UPDATE/DELETE access. No snapshot
of the original body is stored. Older quote-style replies remain plain text.

Deploy/use the updated client only after this migration is applied; its history
query requires the new column and relationship. Nothing was applied automatically.
Reply previews use an explicit self-join through normal authenticated SELECT/RLS.
Missing/hidden originals yield an unavailable preview; unsent originals yield a
tombstone. Polling observes remote changes on the existing five-second schedule;
previously delivered text cannot be recalled from a user's memory or screenshots.

Manual checks with two accounts:
1. Reply to an ordinary message, type only `yes`, and send. Verify the composer
   preview can be cancelled without changing the draft and the bubble has a
   separate preview. Refresh both accounts; `body` should contain only `yes`.
2. Click the preview to focus the original. For older history use Load older
   messages, then click again. Check mobile dropdown and keyboard behavior.
3. Hide the original for one user: that user's preview becomes unavailable; the
   other user's preview stays readable. Refresh and test pagination.
4. Unsend the original: both users lose the original text in previews after the
   next poll. Reply text and timestamps remain. Refresh and verify again.
5. Test Forward, Copy, Unsend, Delete for Me, and pending conversation deletion.
6. Run `supabase/tests/linked_replies_rls.sql` only in a test project with three
   profiles after applying migrations. It rolls back its test writes. SQL tests
   have not been executed by the assistant. Node tests use a mocked Supabase client.
