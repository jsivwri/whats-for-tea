# What’s for Tea?

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

## Add or revise a card

1. Run `npm run inventory -- /path/to/recipe-scans --output private/inventory.json` from this repository. Create the ignored `private/` folder first. The register includes hidden PDFs, SHA-256 hashes, archive and processed copies, and filename-based duplicate candidates.
2. Compare the printed edition, recipe number, ingredient columns and method before choosing a primary copy. Check the original in Archive if a processed crop loses content. A different edition may have different quantities even when its title and cover look similar.
3. Use OCR as a draft where useful. Review against both pages of the best scan. Keep required text, serving-specific amounts, notes and warnings in their original order. Record unverified timings as unknown or card time. Store working transcriptions, raw OCR and scans in the intake workspace.
4. Edit the matching ingredient entries in `release/ingredients.json` and add or update the record in `release/recipes/` using [the v1 schema](schema/v1.ts). Preserve IDs on renames and better scans. Add a redirect to `release/manifest.json` if a published slug changes. Use the existing entries as examples of printed quantities, unused rows, timers and variants.
5. Crop the food images away from card labels and edges. Export the finished-dish photo as hero and thumbnail WebP variants. Use the method photos as references for cookbook sketches and keep each sketch with its original step. Set the file dimensions and publisher credits on the recipe. List reviewed records and media in `release/allowlist.json` and increment the revision for a released update.
6. Run the checks above and open the recipe at both desktop and phone widths. Verify printed portions, image order, oven settings, cautions, ranges and timers before merging.

The library includes 38 recipes from the 40-entry scan inventory. Two extra copies of the chicken tikka card map to the same recipe. Release validation rejects unexpected recipe and media files. A failed CI build leaves the current Pages deployment in place.

See [the implementation brief](implementation_spec.md) for the product behaviour and release checks.
