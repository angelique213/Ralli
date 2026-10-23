# Ralli

Ralli is my CSE 499 Senior Project: a simple social media web application built step by step using React, Vite, and JavaScript.

This initial version only has a Header and a Home page. Accounts, posts, image uploads, challenges, and messaging are planned for later.

## Run the project

Use Node.js 22.12+ (Node.js 24 LTS is also suitable) and npm. From this project folder, run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal, usually http://localhost:5173. Save changes to see the page update. Press Ctrl+C in the terminal to stop the server.

## Project structure

```text
src/
  components/
    Header.jsx       Reusable site header showing Ralli
  pages/
    Home.jsx         Welcome page
  styles/
    index.css        Shared styles and small-screen adjustments
  services/
    .gitkeep         Keeps this empty folder available for future service code
  assets/
    .gitkeep         Keeps this empty folder available for future images
  App.jsx            Combines Header and Home
  main.jsx           Starts React and loads the CSS
```

The `.gitkeep` files are empty placeholders. They do not run any code.

- `index.html` is the HTML page React loads into and sets the browser tab title.
- `package.json` lists dependencies and commands. The package name is `ralli`.
- `package-lock.json` records installed dependency versions for repeatable installs.
- `vite.config.js` enables React support in Vite.
- `.oxlintrc.json` configures the starter's JavaScript code checker.
- `.gitignore` keeps dependencies, build output, and local files out of Git.

## Check the project

```sh
npm run lint
npm run build
```

The first command checks the code for common problems. The second creates a production build in `dist/`. To view that build locally, run `npm run preview`.

## Next small step

Practice editing the welcome text and styles. Then create a reusable `PostCard` component using sample text and show it on the Home page. Learn how props pass data into the component before adding forms, accounts, or a database.


## Supabase authentication

Copy `.env.example` to `.env` if setting up a new checkout. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the project URL and publishable key from Supabase. Never use a secret or service-role key in Vite. Restart `npm run dev` after changing environment values.

In Supabase Authentication > URL Configuration, set the local Site URL to `http://localhost:5173` and add `http://localhost:5173` to Redirect URLs. Use the actual port printed by Vite if it differs. Add your production URL when deploying. Keep email confirmation enabled under the email provider settings.

Sign Up sends registration to Supabase and prompts for email confirmation. Login uses email/password authentication. Logout ends this browser's session. Supabase restores and refreshes session tokens automatically; the application does not store passwords. The publishable key is intended to be visible in a browser bundle.

Guests can read sample posts. Creating posts, liking, and commenting require a session in the UI. The feed now requires the database migration below. React holds a display copy of database records; Supabase RLS enforces ownership.

Test with your own email: register, confirm the email, log in, refresh, create a post, like and comment, then log out. Also test incorrect passwords and unconfirmed email login. Expired confirmation links display an error; request a new confirmation email from the Supabase dashboard if needed.


## Apply the persistent feed migration

1. Open the Ralli project in Supabase, then SQL Editor > New query.
2. Copy all of `supabase/migrations/20261023_ralli_feed.sql` into the editor and run it once. It creates `profiles`, `posts`, `comments`, and `likes` in a transaction. It does not delete existing tables. If a table already exists, stop and inspect the error rather than dropping data.
3. Verify all four tables have RLS enabled in Table Editor. Existing accounts get public display names from signup metadata; future signups are handled by a trigger. Emails and credentials are not copied to these tables.
4. Restart `npm run dev` and open the local URL. An empty database should show an empty feed, not sample posts.
5. Register a second test account if needed. Run all of `supabase/tests/feed_rls.sql` in a new SQL Editor query to check permissions. This uses two existing profiles, temporarily impersonates their database roles, and rolls all test content back. Look for the final passed message. If it errors, run `ROLLBACK;` before another query and investigate.

## Test persistence in the browser

- Log in as account A, create a distinctive post, refresh, and verify it remains. Check its `user_id` and `created_at` in Table Editor.
- Like that post, refresh, and verify the count and Liked state remain. Unlike and refresh again. The likes table must have at most one row per post/user pair.
- Add a comment, refresh, reopen comments, and verify its body, author name, and count remain.
- Log out: public posts and comments should remain readable, while write controls are disabled.
- Log in as account B: account A's data remains, but B starts with its own independent like state. Comment as B and check its display name.
- Try blank input and turn off the browser network temporarily. Failed saves should show errors and keep the draft. Restore connectivity and use retry controls. If a request's response is lost, refresh before retrying to check whether it reached the database.
- Run the SQL RLS test above to verify edits/deletes of someone else's content are denied at the database level. Edit/Delete buttons are not part of this UI step, but ownership policies cover these operations.

Records are public. The app refreshes records on page load and after its own writes; it does not subscribe to live changes from other browsers. This beginner implementation loads the feed in batches and will benefit from user-facing pagination as the project grows.

Validation status: lint/build are code checks, not proof of hosted persistence. Apply the migration and complete the browser tests before considering the hosted database feature verified.

Local verification: the migration and `feed_rls.sql` passed in an isolated PostgreSQL instance with a minimal simulated Auth schema. This does not replace testing against hosted Supabase Auth and its REST API.


## Page URLs

React Router selects Home at `/`, Login at `/login`, and Sign Up at `/signup`. Signed-out visitors can refresh either form URL without returning Home. Signed-in visitors to either form are redirected Home after the session check. Successful logout goes to `/login`.

Vite supports these paths locally. When deploying to a static host, configure a single-page-app fallback so requests for `/login`, `/signup`, and other frontend paths serve `index.html` without redirecting the URL to `/`. Keep asset and API routes separate. This is needed for direct links and refreshes in production.
