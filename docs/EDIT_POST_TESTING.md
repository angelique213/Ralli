# Edit Post and mobile sprint

## What changed

The shared post menu is now `PostActions.jsx` (renamed from `PostDeleteControl.jsx`). Owners can edit text/captions in a keyboard-accessible dialog with Save, Cancel, pending state, and errors. The existing Delete action remains. Only a confirmed Supabase response updates Home/Profile state and announces success. The service updates only `body`, filtering by post ID and owner ID. No image replacement is implemented.

Whitespace-only text posts are rejected; an existing image post can have an empty caption. Maximum text length is 5000 characters. Images, likes and comments are untouched. If a response is lost, refresh to check the actual saved text before retrying. Concurrent edits in separate tabs use last-save-wins behavior.

Mobile CSS increases small action touch targets to 44px, wraps comment controls/counts and long profile/member text, and uses 16px form text to reduce phone auto-zoom. Desktop colors and layout are preserved.

## Database review

No new migration or production database change is needed. Existing `20261023_ralli_feed.sql` grants authenticated users UPDATE on `body` only, with `posts_edit` requiring `auth.uid() = user_id` in both USING and WITH CHECK. The existing `20261113_post_images.sql` enforces text-or-image content and maximum length. Keep these restrictions; do not grant updates on author IDs or image paths.

The local policy tests do not prove your hosted schema matches the migrations. If hosted editing is denied, review those existing grants/policies in Supabase before changing anything. Do not rerun migrations blindly.

## Automated results

- `npm run lint`: passed.
- `npm run build`: passed; existing bundle-size warning remains.
- `node --test tests/post-edit.test.mjs`: 5 passed, using a mocked database client.
- All 7 SQL suites in `supabase/tests` passed against isolated PostgreSQL with simulated Supabase Auth/Storage schemas. The image test now also verifies caption edits preserve images, likes, comments, and reject oversized text. Existing migrations were used only in this disposable local fixture; no production SQL was run.
- Mocked browser checks: edit ownership visibility, Cancel/Escape, blank-text validation, error/retry, saved text after simulated refresh, empty image caption, caption-only request payload. Existing upload/delete regressions passed, including likes/comments, profile rendering, lost responses, cleanup failures, and logout.
- Isolated browser auth checks passed for logged-out redirects/refresh, required login fields, and signup password mismatch. External requests were blocked; no accounts were created.
- Home/Profile/Explore/Challenges passed horizontal-overflow checks at 320, 390, 640, 820, and 1440px with long profile names/bios. Explore/Challenges checks used empty mocked lists; populated long-content layouts still need manual review.

Browser mocks and the local database do not verify real email delivery, actual hosted login/registration, hosted Storage files, CDN behavior, or hosted persistence. Real account profile editing, connections, and challenge interactions were reviewed and SQL-tested but not fully exercised end-to-end against Supabase.

## Manual localhost checklist

Run `npm run dev` and use the address printed by Vite. Use two test accounts and avoid modifying other people's real content.

1. Register/login, check confirmation email, refresh each protected route, log out and use browser Back. The private feed must remain inaccessible after logout.
2. As A, create text-only and image posts. Add a like and comment. Open the menu → Edit Post; change the caption, Save, and refresh. Verify text, image, like and comment remain correct on Home and Profile.
3. Test Cancel and Escape. Try blank/space-only text: Save must be disabled on a text post, but clearing an image caption must work. Test long text, mobile keyboard, and Tab focus.
4. Disconnect networking before saving. Verify an error appears and the draft is kept. Reconnect, refresh to check the outcome, and retry if needed.
5. As B, A's post must have no edit/delete menu. A direct authenticated UPDATE of A's post using B's client must return zero updated rows or a permission error. Do not test using service-role/dashboard administrator access.
6. Verify deleting your test posts, image cleanup, comments, and likes still work. Refresh to confirm persistence.
7. Edit your profile name/bio and upload profile/cover images. Refresh. Search Explore, connect/disconnect B, and verify counts/lists.
8. Create a challenge, verify creator participation, join as B, mark/undo a day, refresh, and leave with confirmation. Verify neither account can edit the other's challenge/progress.
9. At phone/tablet/desktop widths, review populated feeds, long names/captions, profile edit controls, member cards, challenge cards/forms and navigation. Check no horizontal scrolling and that all controls are reachable.

## Vercel

After deployment, repeat the checklist on Vercel, especially direct route refresh and cross-account persistence. A GitHub push may trigger the configured Vercel integration; check its deployment status separately.

## Mobile account navigation

At 768px and below, the compact header shows the logo and a three-dot account disclosure above the navigation row. Edit Profile opens the existing form through `/profile?edit=true`; Logout uses the existing sign-out handler. The large own-profile Edit Profile action is hidden on mobile and retained on desktop. Enter/Space, Tab, Escape, outside click, and focus dismissal are supported.

Mocked browser checks passed at 320, 375, 390, and 768px for menu bounds, keyboard controls, existing profile editing (open/cancel/save), and logout. Desktop visibility was checked at 1440px. Manual Sprint 1 testing was also reported successful by the project owner.
