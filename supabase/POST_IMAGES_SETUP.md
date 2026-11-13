# Feed post images

The composer supports one JPEG, PNG, or WebP image up to 5 MiB (5,242,880 bytes), with optional text. It previews the selected file locally; replacing/removing a preview does not upload anything. Completely empty posts are rejected. Photos display in Home, personal profiles, and public profiles through the shared PostCard.

## Supabase setup (apply once)

The assistant has not applied this migration to hosted Supabase.

1. Open the Ralli project in Supabase. Confirm the existing `posts` table and feed policies are present. Check that `posts.image_path` and the `ralli-post-images` bucket do **not** already exist. If either exists, inspect it before applying anything; do not drop existing resources.
2. The original feed migration names its text constraint `posts_body_check`. You can inspect it in SQL Editor with:
   ```sql
   select conname, pg_get_constraintdef(oid)
   from pg_constraint
   where conrelid = 'public.posts'::regclass and contype = 'c';
   ```
   If your constraint differs, stop and review that difference rather than dropping unrelated constraints.
3. Open **SQL Editor → New query**, paste the entire contents of `supabase/migrations/20261113_post_images.sql`, and run once. This transaction adds `image_path`, replaces only the old text-required constraint with text-or-image validation, grants image-path insertion, creates the new bucket/policies, and verifies referenced uploads exist. Existing posts remain unchanged with a null image path. Do not rerun earlier migrations.
4. If SQL reports an error, run `ROLLBACK;` and inspect the error before retrying. Nothing should be dropped to work around a conflict.
5. In Storage, verify `ralli-post-images` is public, the file size limit is 5242880, and allowed types are `image/jpeg`, `image/png`, and `image/webp`. Existing profile-image Storage policies and buckets are unchanged.
6. Run `npm run dev` locally, open Home, and refresh after setup. No new environment variables, credentials, or dependencies are required.

## Ownership and privacy

Images use unique `<authenticated-user-id>/<random-uuid>.<extension>` paths and upload with `upsert: false`. Existing post RLS still enforces the author ID. The database requires the image path to belong to that author, correspond to a visible uploaded object, and be unique across posts. Only `image_path` INSERT permission is added; image replacement on a published post is not part of this feature.

Storage allows authenticated users to upload in their own folder. Restrictive policies block overwrites even if another permissive policy is present. Users may remove only their own unused images; deletion of referenced images is denied. Metadata SELECT for owners supports validation and cleanup. Existing feed read policies are unchanged.

The bucket is public, matching the existing public post-read policy: anyone with an image URL can read that image. The login-required UI does not make those URLs private. No service-role key is used in frontend code. Storage's API enforces the bucket size/MIME settings; the browser also checks that the file can be decoded as an image.

## Failed saves and cleanup

Publishing uploads the file first, then inserts the post. A successful post appears only after Supabase confirms it or a recovery query finds the saved row by its unique image path. Double-clicks are blocked while publishing.

- A failed upload never starts a post insert. Cleanup is attempted for that attempt's unique path.
- If a post insert returns a definite database rejection (for example a constraint or permission error), cleanup is attempted through the Storage API.
- If the save response is lost, the app first queries for a post referencing that image. If found, it displays that saved post without uploading or inserting again.
- If the result remains uncertain, the image is retained and further posting is disabled until refreshing to check the saved feed. An image must not be deleted just because the browser did not receive the save response.
- If cleanup fails, the error says so. Browser closure, an upload completing after a lost response, network outages, and deletion of posts outside this UI can leave unused objects. Periodically compare Storage paths against `posts.image_path` and remove only confirmed unused objects through Storage. Do not delete Storage metadata directly with SQL or delete a file solely because an interrupted request looked unsuccessful.

This is best-effort cleanup, not an atomic transaction between PostgreSQL and object storage. A background cleanup job is not included.

## Manual browser tests with real accounts

1. Log in as A. Confirm a blank composer cannot publish. Type a text-only post and publish; existing behavior must work.
2. Select a valid photo. Confirm the preview and filename, replace it, then remove it. Removing it from an otherwise empty composer should disable Post. Preview changes should not create files in Storage.
3. Publish text plus a photo. Verify the correct author/avatar, text, photo, and normal like/comment controls. Refresh and verify both text and photo remain. Check the same post on your Profile page.
4. Publish a photo without text (also try spaces only). Verify it saves, displays without an empty text block, and remains after refreshing.
5. Try an SVG/text file, an invalid/corrupt PNG, an empty file, and an image over 5 MiB. Each should show an error without uploading. JPEG, PNG, and WebP under the limit should work.
6. Click Post rapidly. Expect one post. Confirm the preview and text clear only on a successful save and remain available after a definite failure.
7. In a test environment, disconnect networking while uploading/publishing. Read the error, reconnect, and refresh to check whether the post saved before retrying. Verify the app does not falsely report success or remove a saved image. Known-rejection cleanup and lost-response recovery are covered by the mocked tests, not proven by a normal successful upload.
8. As B, open A's feed/profile post, view the image, like/unlike, and comment; refresh to confirm saved activity. Confirm B cannot upload into A's folder or overwrite/delete A's image using B's authenticated client. The Supabase dashboard's administrator access is not a user-RLS test.
9. Test a narrow phone, tablet, and desktop. Ensure preview/feed photos fit their cards, retain proportions, and do not create horizontal scrolling. Check keyboard focus on Add/Replace/Remove and Post. Test the Retry photo action after an image-load failure.
10. Verify login/logout, profile editing/uploads, Explore/connections, and Challenges still behave normally.

## SQL tests and verification limits

`supabase/tests/post_images_rls.sql` is a rollback-only test with two profiles. It inserts temporary Storage metadata (no actual file bytes) and tests image-only posts, empty posts, nonexistent/foreign images, duplicates, overwrite protection, referenced-image deletion denial, and unused-file cleanup. It temporarily creates broad test policies to verify the restrictive guards and rolls everything back. Prefer an isolated test database/project. If the hosted Storage service prohibits direct SQL metadata operations, do not bypass its protection; use authenticated Storage API tests instead. Run `ROLLBACK;` if a SQL test stops with an error.

The existing `feed_rls.sql` and `profile_rls.sql` remain unchanged and can be used for regression checks. SQL fixtures do not test actual file uploads, MIME validation, size limits, CDN delivery, or hosted persistence. Those require the real-account browser/API checks above.

References: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [Storage remove API](https://supabase.com/docs/reference/javascript/storage-from-remove).

## Checks completed for this change

- `npm run lint` and `npm run build` passed. The existing Vite bundle warning remains (main JavaScript about 534 kB minified).
- The new migration and `post_images_rls.sql` passed in isolated PostgreSQL with simulated Auth/Storage schemas. Existing feed and profile RLS regression tests also passed.
- Mocked browser tests passed: invalid types, oversized/corrupt files, preview replacement/removal, image-only/text+image/text-only posts, duplicate-click prevention, refresh, profile rendering, like/unlike/comment interactions, upload failure, definite-save cleanup, cleanup failure, lost-response recovery, uncertain-save protection, image-load retry, and logout.
- Browser layouts passed overflow checks at 320, 390, 820, and 1440 pixels; desktop and phone screenshots were inspected.
- No application mock records or new dependencies were added. Hosted Supabase uploads, persistence, Storage API enforcement, and cross-account behavior remain unverified until setup and the real-account checks above. No hosted migrations were applied.
