# Delete Post

No new migration is needed. The existing feed migration (`20261023_ralli_feed.sql`) enables posts RLS and its `posts_delete` policy allows only `auth.uid() = user_id`. Comments and likes reference posts with `ON DELETE CASCADE`.

Image cleanup requires the existing `20261113_post_images.sql` migration. If you already applied it for photo uploads, do not rerun it for this feature. Otherwise follow POST_IMAGES_SETUP.md in Supabase SQL Editor first. No hosted migration was run by this implementation.

## Deletion order and recovery

1. Only an owner's card shows Post options. Cancel or Escape leaves the post unchanged.
2. After confirmation, Supabase deletes the owner's post and cascades its comments and likes. The client checks that a row was actually deleted.
3. The card disappears and the profile post count updates.
4. For an image post, the client uses the image path returned by the deleted database row. It validates the owner's folder and removes the unused file from `ralli-post-images`. Existing Storage policies reject foreign uploads and images still referenced by posts.
5. A failed cleanup leaves an explicit warning and Retry photo cleanup action outside the removed card. An already removed file can be verified and treated as cleaned up.

Database deletion and Storage removal are separate requests, not an atomic transaction. If a database response is lost, refresh before retrying; the image is not removed without confirmation. If you close or leave the page before cleanup completes, the retry notice is not retained. An administrator can check the exact unused file in Supabase Storage, verify no posts reference its path, and delete it manually. Never delete an image still attached to a post. Removing a file does not revoke copies already downloaded or cached.

## Manual verification with real accounts

1. Log in as A. Create a text post and an image post. Add a like and comment using B if available.
2. As B, verify neither A post offers a Delete Post option. Direct authenticated API deletion of A's post must affect zero rows; foreign Storage deletion must not remove A's image.
3. As A, use the three-dot button by mouse or keyboard. Check Cancel and Escape preserve the post. Confirm the exact warning and Delete.
4. Delete the text post. It should disappear from Home and your Profile after navigation. Refresh and verify it stays gone. Verify its likes and comments no longer exist in Supabase Table Editor.
5. Delete the image post. Wait for “Post and photo deleted.” Check the exact object is absent from the ralli-post-images bucket, then refresh.
6. If cleanup fails, keep the page open, restore connectivity and use Retry photo cleanup. A deletion error should remain visible in the dialog and must not report success.
7. Check at mobile and desktop widths. Verify other posts, uploads, likes, comments, profile editing, navigation and logout still work.

## Automated checks

`npm run lint` and `npm run build` check the application. `supabase/tests/post_deletion_rls.sql` is a rollback-only integration test for an isolated database with the existing migrations, auth fixtures, and Storage schema. It checks ownership, anonymous denial, cascading comments/likes, and storage deletion ordering. Do not run test fixtures against production casually.

Local SQL tests use a simulated Supabase auth/Storage schema. Browser tests use mocked Supabase responses. Neither proves your hosted project's policies or persistence; complete the real-account checks above against your project.
