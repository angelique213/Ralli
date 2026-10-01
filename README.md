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
