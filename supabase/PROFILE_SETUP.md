# Profile customization setup

The application code is ready, but the new database/Storage setup has NOT been applied by the assistant. A read-only hosted check found that `profiles.bio` is absent. Bucket listing with the public key returned no visible buckets; that is not an admin inventory.

1. In Supabase Table Editor, confirm the existing `profiles` table has `id`, `display_name`, and `created_at`.
2. In Storage, check for an existing `ralli-profile-images` bucket. If it exists, inspect its configuration and policies before proceeding. This migration deliberately fails on duplicate columns/bucket names instead of changing existing resources silently.
3. Open SQL Editor, paste all of `supabase/migrations/20261030_profile_customization.sql`, and Run once. Do not rerun the initial feed migration. The transaction adds bio and image-path columns, grants only those profile edit columns, adds owner-only RLS, and creates a public image bucket with a 5 MiB limit and JPEG/PNG/WebP MIME restrictions. It also changes the existing Auth sync function to leave already-created profiles unchanged, preventing old metadata from resetting edited names. Existing accounts, posts, likes, and comments are preserved.
4. If SQL fails, run `ROLLBACK;`, inspect the error, and resolve it before retrying. Do not drop existing tables or buckets.
5. Verify the bucket is public, the size limit is 5242880 bytes, and allowed types are image/jpeg, image/png, image/webp. Check Storage policies and profile RLS in the dashboard. The migration includes restrictive ownership guards to constrain broader policies if present. Never add service-role keys to Vite.
6. Refresh `/profile`. The setup message should disappear and editing become available.

Public names, bios, and images are readable publicly (as the existing public profile policy allows). The email shown on About comes only from the logged-in Auth account; it is not copied into public profiles.

## Test with real accounts

- As A, edit name and bio, Save changes, refresh, and confirm both remain. Check blank names and bios over 300 characters are rejected (the UI also caps input length).
- Upload an actual JPEG, PNG, or WebP for both avatar and cover; refresh and verify both. Try a text/SVG file, a corrupt PNG, and a file larger than 5 MiB: none should be saved.
- Disable networking during a save; verify there is an error and no success message. Restore networking and refresh before retrying, in case the server saved the request before the response was lost.
- Switch Posts/About, navigate Home/Profile, create a post, refresh, and check the count and list. Like/unlike and comment on a post; refresh and verify persistence.
- Log out and visit `/profile`; expect Login. Log in as B and verify B's own profile and posts. Never use a service-role key for this test.
- Run all of `supabase/tests/profile_rls.sql` in SQL Editor with two accounts present. It tests own/other profile writes, invalid image references, bio limits, and cross-user Storage paths, then rolls back. If it errors, run `ROLLBACK;`. It does NOT test actual file bytes or Storage API limits. Run the existing `feed_rls.sql` separately for posts/likes/comments.
- To verify real Storage ownership through the API, use B's authenticated browser client and attempt an upload to A's UUID folder in the ralli-profile-images bucket: expect a policy error. Do not use dashboard admin uploads for this check because admin privileges bypass user RLS.
- Test desktop and narrow/mobile widths. All controls should remain usable.

## Upload behavior and cleanup

New image filenames are unique and stored below `<user-id>/avatar/` or `<user-id>/cover/`. A success message appears only after Storage upload AND the profile row update succeed. Replacements do not overwrite previous files. Old/unreferenced images are retained to avoid deleting a file after a lost network response or concurrent save. Periodically review and remove unused files in the Storage dashboard, checking that no profile path references them. Automatic cleanup/cropping is not implemented.

## Verification limits

Lint/build and isolated browser tests do not prove hosted persistence or RLS. Complete the real-account checks above after applying the migration. The assistant does not have authenticated test accounts or administrator access and did not apply this migration.

Local verification completed: both migrations and both RLS test files passed in an isolated PostgreSQL 16 database with simulated Auth/Storage schemas. Browser checks used intercepted test responses for saved edits/images, invalid and oversized files, tabs, refresh, errors, account filtering, likes/comments, logout protection, and responsive layouts. These checks are not real Supabase account tests. Lint passed; build passed with Vite's warning that the main minified JavaScript bundle exceeds 500 kB.
