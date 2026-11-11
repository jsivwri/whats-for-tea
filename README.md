# What’s for Tea?

See the [recipe card intake checklist](INGESTION.md) for adding cards or rebuilding the catalogue.

A public, responsive cookbook built from household recipe cards. The GitHub Pages site serves the same catalogue, photos and cooking instructions on every device. Pantry ingredients, favourites and cooking activity are stored per browser. Use **Settings → Export settings** to move that activity to another browser.

## Run locally

Requires Node 22.18 or newer.

```sh
npm ci
npm run dev
npm run validate
npm test
npm run build
npm run smoke
```

The app uses React, TypeScript and Vite. Hash routes support direct links and refreshes on a static host. The manifest points to a content-addressed index, recipe records and media. Opening Browse loads summaries. Opening a recipe loads its full record.

## GitHub Pages

In the repository’s **Settings → Pages**, select **GitHub Actions**. The workflow validates the catalogue, runs matching tests, builds the app with the project base path and checks the production output. A successful build of the default branch deploys the public site. The workflow derives the base from the repository name and also supports an owner site at the root.

Release validation rejects unexpected recipe and media files. A failed CI build leaves the current Pages deployment in place.

See [the implementation brief](implementation_spec.md) for the product behaviour and release checks.
