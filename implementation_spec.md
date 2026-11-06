# Recipe card library · implementation spec

**Working title** · What's for Tea?
**Target** · A responsive web app in a GitHub repository, deployed to GitHub Pages
**Research date** · 6 November 2026

## 1. Product brief

Turn a household's collection of HelloFresh, Gousto, Green Chef and other recipe cards into a cookbook that helps decide what to make, then stays open on the kitchen counter while you make it. Find a remembered dish by name, recognise it from a photo, or start with whatever needs using up. In one visit, go from “I've got chicken thighs, peppers and some yoghurt” to a shortlist, an honest view of what's missing, and the full method for the chosen dish.

The signature flow is **What's for tea? → What have you got? → Pick a dish → Cook it**. The result should feel like browsing your own recipe box. Photos help you recognise meals, reasons help you choose, and Cook Mode turns the original printed instructions into a readable sequence.

**Launch scope.** Photo grid and compact name list, title search, filterable collections, plain-text pantry matching, a ranked dinner shortlist, complete recipe pages, guided Cook Mode, favourites, and a repeatable Codex-assisted import pipeline. Step photos are a best-effort content enhancement. OCR and recipe editing happen during development. The browser runs the interface and search against prepared data.

**Launch quality bar.** On a phone, a household member can find a remembered recipe, decide what to make from a few fridge ingredients, and finish cooking a dish without referring back to the paper card. The release checks in §9 make those three journeys testable.

## 2. Market research and product decisions

| Product | Observed feature | How it informs this app |
| --- | --- | --- |
| SuperCook | A pantry drives suggestions and results adjust as ingredients are added or removed. | Keep the input lightweight. Paste several ingredients, confirm the matches, and see the shortlist update immediately. [SuperCook](https://www.supercook.com/recipes/en) |
| Samsung Food+ | Food List search can prioritise ingredients approaching expiry. | Let people mark one or more items **Use first** with a tap. That gives the ranking a useful signal even for a quick fridge clear-out. [Samsung Food+](https://samsungfood.com/food-plus/) |
| Gousto and HelloFresh UK | Gousto groups meals into collections and surfaces low-prep options. HelloFresh's pesto orzo page puts a dish photo, time, serving options, ingredients and numbered illustrated steps together. | Use recognisable photos and practical collections, with separate time facets. Keep the provider and card version visible in the recipe detail. [Gousto menu](https://www.gousto.co.uk/menu/) · [HelloFresh recipe example](https://www.hellofresh.co.uk/recipes/mediterranean-style-chicken-and-creamy-pesto-orzo-69f21377d52e296f6a387fb7) |
| SideChef | Guided cooking uses step photos and offers built-in timers. | Give each printed step a focused screen with its own image when available and a timer where the source supports one. [SideChef](https://www.sidechef.com/business/about-us) |
| Paprika | Cooks can check off ingredients, highlight the current direction and manage timers. | Make progress visible and durable. A quick look at the ingredients or a page refresh should return you to the same step. [Paprika iOS guide](https://paprikaapp.com/help/ios/) |

**Product hypothesis.** A small library of meals you already know can be faster to choose from than a much larger catalogue. Test that by giving people a shortlist with reasons such as “Uses your leeks · missing only crème fraîche”, then watching whether they can choose dinner without opening several recipes first.

## 3. Screens and interaction

| Screen | What the user can do |
| --- | --- |
| **Today** | Start with a prominent pantry field, use the **Ready in 30 min**, **Low prep** or **Pick a theme** shortcuts, or go straight to Browse. Show one strong suggestion and up to four alternatives once the user has entered ingredients or picked a constraint. Each result says why it fits and has a direct recipe link. With no preferences yet, show curated shelves such as **One pan**, **Comfort food** and **Recently added**. Offer **Resume cooking** when there is a saved session. |
| **Browse** | Switch between an image-led grid and a compact A–Z list, retaining the query, filters and result set. Search the full card title, subtitle and reviewed title aliases. Use cuisine, theme, ingredient, provider, prep time, cook time and total time filters. Show result counts, removable filter chips and a clear reset. Sort by name, recently added, quickest total time or lowest prep time. Use a filter drawer on phones and an inline toolbar or sidebar on larger screens. |
| **Pantry** | Type or paste ingredients, select recognised suggestions, resolve ambiguities and mark **Use first**. Reuse Today’s controls and ranking. Results show matching items, the named shopping gap, and the assumed cupboard basics on demand. Offer **Copy missing ingredients** from a recipe, preserving its original ingredient labels. Pantry input remains editable beside the results. |
| **Recipe** | Show dish photo, full title, provider, separate timing labels and the available printed portion sizes. Group ingredients into **In your pantry**, **Still needed** and **Optional** when matching is active. Show box contents and bring-your-own ingredients in source order in the default view. Include equipment and source notes where printed. Make the complete method, tips and warnings readable as a numbered list, with a **Start cooking** action and a save button. The original provider page is a secondary link when it has been verified against the card version. |
| **Cook Mode** | Start with a **Before you start** checklist for equipment and quantities, then show one complete step at a time. Keep a large step number, progress indicator, visible **Back** and **Next** buttons, and an ingredients drawer. Support a jump list so cooks can revisit a parallel task or skim ahead. Keep the step’s full text visible on demand even on small screens. Show the step photo when usable and let it expand. Preserve step and ingredient checkmarks on refresh. Finish with **Cooked it**, which records the date locally and closes the session. |
| **Saved and Settings** | Browse favourites and recently cooked meals. Settings manages cupboard assumptions, the public library version, and local data export, restore and reset. Show how to open the same catalogue on another device. |

### Interaction details

- The design should feel like a modern printed cookbook. Use warm off-white backgrounds, dark readable text, a single accent colour and consistent 4:3 grid crops. Use a larger hero on recipe pages. Put names and time labels on solid surfaces. Keep the full dish title visible on the detail page and in the accessible name of each result.
- Use bottom navigation on phones for **Today**, **Browse**, **Pantry** and **Saved**. On desktop, use a header and let photographs expand into a wider grid. Cook Mode uses the full viewport with a large type option, 48 px minimum primary touch targets and controls above the device's safe area. Navigation works with visible buttons and a keyboard. Swipes can be added as a shortcut later.
- Reflect input immediately. An explicit facet change updates the count, selected chips and results together. Preserve filters, sort, display mode and scroll position on back navigation from a recipe. Offer a specific recovery when there are no results, such as **Include unknown prep times** or **Allow up to two missing items**. The user applies any change.
- Reserve image dimensions to avoid layout jumps. Use a designed typographic fallback with the dish name and theme when a hero is missing or fails to load. A step without an image becomes a text-led step with the same controls.
- Meet WCAG 2.2 AA. Implement keyboard navigation and focus return for drawers, accessible ingredient suggestions, live result counts announced after edits settle, visible focus, adequate contrast and reduced-motion support. Pair colour-coded states with text. Test zoom, screen readers and sticky controls so focus and instructions remain visible. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 4. Search, filters and recommendations

### Title search and browsing facets

Rank an exact title or alias above a title prefix, then rank matches on all query words above typo matches. Index full names and reviewed short names such as `pesto orzo`. Fold case, accents and punctuation, and support controlled spelling variants such as `chili` and `chilli`. Keep title search separate from pantry entry so a query for `chicken` can mean a dish name in Browse or an ingredient in Pantry.

Start with a short controlled taxonomy. **Cuisine** describes culinary inspiration, such as Mediterranean or Thai-style. **Theme** describes an occasion, style or format, such as Comfort food, Family favourites, One pan, Traybake and Slow cooker. Build time-based shelves from actual time fields. Record whether a tag was printed or assigned in review. A recipe can have more than one theme. Match any selected value within a cuisine, theme or provider facet, and combine different facets with AND. The ingredient facet requires all selected ingredients. When filtering an ingredient family such as `chicken`, include its indexed children such as `chicken thigh`.

### Time semantics

Keep **Prep**, **Cook** and **Total** distinct. Total means the elapsed start-to-serve time as reported by the source. Keep a card's raw time label and range alongside its reviewed meaning. A single cover time of uncertain meaning can appear as **Card time** and stays out of the three strict facets until its meaning is confirmed. Record a verified same-edition provider page as the provenance when it resolves a label.

Use the upper end of a range when applying a maximum. For example, a verified `25–35 min total` passes a 35-minute limit. When a matching field is unknown, omit it from a strict time filter by default and offer **Include unknown times** with those results clearly marked. Sort unknowns last for the relevant sort. Avoid deriving total or prep from the sum of step durations, which may run in parallel. **Ready in 30 min** filters on total time and **Low prep** uses a 15-minute prep limit. The pilot should measure how much of the library these facets can actually cover. Add separately labelled household timings in a later release if useful.

### Plain text to canonical ingredients

1. Accept a single item or paste with commas, newlines, semicolons or a simple list using `and`. Keep recognised phrases together, including names containing punctuation. Handle a common prefix such as “I've got” and simple leading quantities or units. Keep the original input until the user has seen the parse. Example input `2 spring onions, 300 g chicken thighs and some yoghurt` yields three ingredient chips when each phrase resolves to a reviewed label or alias.
2. Maintain a versioned dictionary from recipe ingredients. Each entry has a stable ID, preferred UK English label, reviewed aliases, and an optional broader family. Normalise case, diacritics, whitespace and common punctuation. Examples of explicit aliases are `scallion` → `spring onion`, `eggplant` → `aubergine`, and `ground beef` → `beef mince`. Preserve meaningful forms such as `dried basil`, `fresh basil`, `tomato purée` and `chopped tomatoes`.
3. Commit an exact, unique name or alias. For typos, show up to three candidate chips ranked by phrase prefix and bounded edit distance. Require a tap or keyboard confirmation for fuzzy matches, competing aliases or vague terms such as `cream`. An unresolved ingredient stays visible and never contributes to a match. Deduplicate committed chips by ID and allow one-tap correction and removal.
4. Treat a broad pantry term as uncertain. `Chicken` can help find dishes in the chicken family, but only a specific match such as `chicken thighs` satisfies a recipe that calls for thighs. A specific pantry item can satisfy a generic recipe requirement when the reviewed dictionary explicitly permits that direction. Prompt the user to narrow a broad item where useful.
5. Store ingredient presence in v1. Leading quantities help parse the text. Use the recipe's printed quantities and show **Check quantities** with the match summary. Box-specific pastes, seasonings and blends remain distinct. A publisher-printed variant can be selected explicitly with its own requirements. Suggested substitutions are a later feature with a separate label and review trail.

### Ranking and explanation

- Start with the requirements for the selected printed serving size. Exclude rows marked unused for that size and genuinely optional ingredients. Count each distinct ingredient requirement once. A line such as `olive oil` can be assumed only if it is among the explicitly enabled cupboard basics. Show the default list of salt, black pepper, neutral cooking oil and tap water at first use. Allow the user to edit or turn it off. Specific oils, butter, sugar, spices and stock each require their own match or explicit assumption.
- Apply the title and chosen filters first. Compute the matched IDs, assumed basics, missing IDs and matches marked **Use first**. A broad pantry term can surface an otherwise relevant dish as a possible lead, with the precise item still listed as missing. With active pantry input, default to recipes with at least one actual or family-level connection to that input. Allow **Show all matching filters** for independent browsing.
- Group results into **No missing items**, **Missing 1–2** and **More ingredients needed**. Within those groups sort by fewest missing, then most **Use first** matches, then proportion of requirements matched after excluding assumed basics, then the relevant time when a time shortcut is active, then title and stable ID. A time sort explicitly selected in Browse takes precedence there. With no confirmed pantry inputs, use the selected theme/time preferences or the curated Today shelves and hide pantry match claims.
- Explain each match from the same computed sets that drive the ranking. Example copy `Uses your leeks and orzo · missing crème fraîche`. Label the portion size the calculation uses and show assumed basics and the full named gap on tap. A recipe only gets **No missing items** when every required ingredient is present or explicitly assumed. Show verified allergen label information and preserve printed cautions in the recipe detail.

## 5. Recipe data and cooking behaviour

Use versioned UTF-8 JSON, a shared schema and a validation command. Use the same recipe record for local review and the public household library. Build a compact search index from the reviewed records. The data shape can borrow the vocabulary of Schema.org Recipe while adding the serving, review and matching details the app needs. [Schema.org Recipe](https://schema.org/Recipe)

| Entity | Fields and rules |
| --- | --- |
| `Recipe` | Stable `id` and slug, title, subtitle, search aliases, provider, source reference, optional source URL, date added, hero asset, cuisine/theme IDs, timing fields, supported serving sizes and default, optional variants, equipment, before-start notes, ingredients and ordered steps. Stable IDs survive a rename or better rescan. Use a redirect map for any published slug changes. |
| `Timing` | `prep`, `cook` and `total` are individually nullable. Each known value holds `minMinutes`, `maxMinutes`, `sourceLabel` and a provenance reference. Use identical bounds for a single duration. Retain ambiguous cover times separately. Store step timers in seconds on the step record. |
| `IngredientLine` | Stable line ID, canonical ingredient ID, original label, source group, required/optional flag and quantities keyed by printed serving size. Store the exact printed amount and unit, plus a numeric amount when safely parseable. Distinguish an explicitly unused row from an illegible or missing amount. Keep garnish, kit contents, pantry additions and branded sachets distinct where the card does. |
| `Step` | Stable ID, source step number, optional heading, ordered text blocks and substeps, source tips and important notes, optional ingredient line references, structured serving-specific quantities where applicable, optional image and verified timer cues. Preserve order, parallel-work cues, temperatures, units, doneness cues and conditional branches. |
| `Asset` | Stable asset ID, dimensions, sizes, aspect ratio, short descriptive alt text where the image adds information, and a credit. The internal manifest also records original scan and page/crop coordinates. Use an empty alt attribute for a decorative photo that duplicates adjacent text. |
| `SourceRecord` | Internal scan hash, publisher, confirmed edition or card code when present, page locators, review status and publishing status for text and each asset. Keep filenames, local paths, raw OCR and review notes in the private development workspace. Release only user-facing attribution and verified links. |

**Serving sizes.** Offer the printed options only. A change updates both ingredient quantities and any corresponding inline amounts in steps, including water. Where a step explicitly prints alternatives for several sizes, retain them in the data and show the chosen amount in context. If the user picks a publisher variant, switch its ingredient list, applicable step instructions and pantry calculation together. Keep the default when starting a fresh session and persist the user's choice in the active session.

**Cook Mode.** Display the whole reviewed method, including all meaningful substeps, tips and important notes. Timers are user-started from reviewed durations. For a printed range such as 12–15 minutes, offer the two endpoints and keep the doneness cue visible. Keep concurrent timers named and accessible while moving between steps. Persist absolute end times and recalculate on resume. Show expired timers on return because browsers can suspend background pages. Offer **Keep screen awake** on supported browsers while Cook Mode is visible, with graceful fallback. [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)

## 6. Codex-assisted card intake

The initial inventory covered **40 two-page scans**. By filename, 23 are Gousto, 14 HelloFresh, one Green Chef and two untitled. At the end of the review, 30 filenames appeared in both `Archive/` and `Processed/`, and 10 were in the top-level folder. Register the same-name archive and processed copies together for review. Separately, compare the two same-title pairs with suffixed filenames for possible duplicate cards. Each page of the three visually inspected originals is a single full-page image with no extractable text. The two processed counterparts spot-checked also had no text layer. Plan for OCR and photo cropping on this batch.

| Local sample | Implication for intake |
| --- | --- |
| Gousto · Classic Chilli Con Carne | The scan is sideways, with eight step photos. The cover has a time range, and there are 2/3/4-person amounts, serving-dependent water in the steps and a separate **You need** list. Confirm the meaning of the cover time and parse the serving columns and step text together. |
| HelloFresh · Mediterranean Style Chicken and Creamy Pesto Orzo | The sideways scan has six photo steps with lettered substeps, printed pantry water amounts and an optional finishing branch. The matching provider page labels the 25-minute figure as total. Keep the card's details and confirm edition before taking any value from the site. [HelloFresh source page](https://www.hellofresh.co.uk/recipes/mediterranean-style-chicken-and-creamy-pesto-orzo-69f21377d52e296f6a387fb7) |
| Green Chef · Beef Moussaka with a Rocket Salad | The scan is upside down, with visible shadows, six step images, a labelled 45-minute cook time and a printed pork-mince variant. Preserve the 2/4 serving options and capture the variant as a conditional branch. |

### Repeatable batch workflow

1. **Register.** Keep original PDFs and processed derivatives in local input folders. Inventory hidden and untitled files, hash them and assign a scan record. Keep the original and usable derivative linked after confirming they depict the same card. Use exact hashes for identical files. Compare publisher, card codes, titles, quantities and methods to distinguish repeat photographs from real editions or variants. Keep the clearer scan as primary when the recipe is the same and preserve both references.
2. **Read.** Orient each page, correct perspective and crop card edges. Use a PDF text layer when present and OCR or Codex-assisted visual transcription for scanned pages. Extract table cells and method blocks by page region where possible. Record uncertain text and keep locators so the reviewer can find the original crop.
3. **Normalise.** Produce a draft against the schema. Map raw labels to the ingredient dictionary, suggest aliases and tags, and keep original display text. Extract the complete cooking method in card order. Keep notes about pantry extras, temperature settings, serving sizes and quantities. Leave uncertain fields explicit for review.
4. **Crop photos.** Extract discrete embedded photos when available. For photographed cards, crop the hero and each numbered step from the corrected page, using publisher layout presets and manual overrides. Exclude QR codes, labels, borders and incidental background. Match every crop to its step number and review for glare, legibility and misleading framing. Use width variants up to 480/800/1200 px for the hero and up to 720 px for steps, capped at usable source resolution. Export optimised WebP, strip scan metadata and use the text-led layout when a crop fails review.
5. **Review.** Compare every step and ingredient table with the scan. Check fractions, decimal points, oven/fan/gas settings, units, timing ranges, printed serving columns, warnings and variant branches. Confirm recipe identity, tags, aliases and hero/step image mapping. Log unreadable content for a rescan. An unreadable required line or method step blocks release for that recipe. A missing optional photo or unreported time can pass with the corresponding fallback.
6. **Build.** Write approved records and media to the target library, regenerate the index and validate references and publishing status. Emit a batch summary with new, updated, duplicate and held records, unknown timing coverage and usable photo counts. Re-running an unchanged batch produces the same recipe IDs and no duplicate records. Each subsequent scan batch follows the same process.

## 7. Static architecture and deployment

Use **React, TypeScript and Vite** with plain CSS and a small set of design tokens. React keeps browsing and pantry state responsive. Pure TypeScript modules handle text matching, facets and ranking so behaviour is straightforward to test. Use GitHub Actions to validate and build `dist/`, then deploy that directory to Pages from the default branch. Configure the Vite base for the GitHub project path and use it for data and asset requests. Hash routes such as `/#/browse` and `/#/recipe/<slug>` support bookmarks, back/forward navigation and direct reloads under `/<repo>/`. [Vite deployment guide](https://vite.dev/guide/static-deploy.html#github-pages) · [React Router HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter) · [GitHub Pages Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Keep UI and catalogue logic under `src/`, the versioned validation contract under `schema/`, and the batch, index and release commands under `scripts/`. Read the catalogue from versioned static release files through one interface for the summary index, full recipes and media. Run schema validation, matching tests and a production-build smoke test in GitHub Actions before deployment.

### Public household library

Deploy the app and the prepared household catalogue together on public GitHub Pages. The same URL opens the same recipes, methods and photos on any device. No sign-in, ZIP install or passphrase is required. The household has approved public visibility for this collection. Show publisher and card-edition attribution on every recipe. Add only reviewed records and usable crops to the release allowlist.

Keep raw scans, OCR, review notes and local paths in the intake workspace. Commit the reviewed recipe JSON, ingredient dictionary and optimised media to the GitHub repository. Validate the release manifest, index, recipes, media references and built artifact before publishing. The same static build also runs locally for review.

Store pantry, favourites, recently cooked meals and Cook Mode progress per browser. Provide an export and restore for these settings. The shared recipe library updates from GitHub Pages on each device when the site is loaded. Household activity stays on the device.

### Data loading and performance budgets

- Load the app shell and small recipe summary index first. Load full methods and larger photos when a recipe is opened. Use immutable versioned data files and a release manifest so an update cannot accidentally mix index and detail revisions. Limit the first grid page to 24 cards and reveal further results without losing filter state. Keep step imagery lazy and prefetch at most the next step after the current view has loaded.
- Initial targets on a representative mid-range phone are a usable Browse screen within 2.5 seconds on throttled 4G, a visible update within 100 ms for pantry and facet interactions with 500 recipes, and at most 200 KiB gzip for the initial JavaScript bundle. Budget roughly 75 KiB per grid thumbnail and 100 KiB per typical step image, with room for exceptions that justify the extra detail. Measure on the production build with an expanded fixture library. The published site has a 1 GB Pages limit. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

## 8. Build order

| Milestone | Deliverable and exit check |
| --- | --- |
| **1 · Card and UX pilot** | Review six to eight cards across the three providers, including an untitled scan, a duplicate candidate, a time range, a variant and a serving-sensitive step. Produce reviewed records, at least one good hero and one usable step-photo series per provider where the scan permits. Measure the proportion with confirmed prep, cook and total timings. Walk through the proposed mobile screens with the pilot recipes. |
| **2 · Find dinner** | Build Today, Browse and Pantry with live filters, gallery/list views, aliases, named gaps, time rules, favourites and use-first ranking. A pilot user can find a dish from a fragment of its title or a pasted fridge list. |
| **3 · Cook from it** | Build recipe detail and Cook Mode, including step images, portion handling, important notes, checklists, timers and resume. Cook a pilot recipe from a phone and check the final screen against the source card. |
| **4 · Release and expand** | Add the public build checks and deploy the reviewed household catalogue to GitHub Pages. Account for the 40 scan entries as imported, duplicate or held for review. Repeat intake with a later batch to verify updates, deduplication and state retention. |

### Ideas worth testing after launch

- **Two dinners, one shop.** Pick a pair of recipes that use the same opened ingredient and combine what is missing. Test it with ingredients such as crème fraîche or a bag of greens where shared use is plausible. Add quantity-aware suggestions only when the data supports them.
- **Household timings.** After cooking, optionally record how long prep and dinner actually took. Show a separate **Your kitchen** figure once there are enough entries to be meaningful. This could make low-prep filtering more useful for cards with sparse timings.
- **Make it again.** Let the user write a note after cooking and surface it next time. Start with a simple private note such as “Needed a bigger pan” before considering ratings or preference models.
- **Offline kitchen.** Cache recipes deliberately saved for offline use and test startup in airplane mode. Try read-aloud instructions once the visible flow is working well. Keep both features driven by the same verified step data.

## 9. Acceptance checks

- **Find a remembered dish.** From mobile and desktop, partial text such as `pesto orzo` finds the expected pilot dish. The gallery and list show identical results. A combined theme, ingredient and time filter stays applied when opening a recipe and returning to Browse. Aim for under 15 seconds from the home screen for the title task.
- **Find dinner from the fridge.** Pasting `2 spring onions, chicken thighs and yogurt` resolves the reviewed aliases. Correcting a chip or marking **Use first** updates ranks and the named shopping gap immediately. A typo remains a suggestion until confirmed. `Chicken`, `chicken thighs` and `chicken breast` follow the specificity rules. Confirm that a required sachet still shows up in the gap. Aim for a defensible shortlist within 30 seconds of entering ingredients.
- **Respect time constraints.** A verified 25–35-minute total passes a 35-minute maximum and fails a 30-minute maximum. A recipe with only cook time can pass the cook filter. A recipe without a confirmed prep time enters a prep-filtered list only after the user includes unknowns.
- **Cook from the screen.** Verify every step against each pilot card. Change from two to three servings on a compatible card and check both the ingredient table and inline water quantity. Check that the Green Chef swap changes the match and applicable steps. Open a six-step and an eight-step recipe, confirm all approved images map to the correct step, test the text-only fallback, and reload mid-cook with a timer active. Verify the method and controls with mobile Safari, Android Chrome, keyboard and a screen reader.
- **Import the next batch.** A renamed duplicate retains its recipe ID and favourite. A better scan replaces the relevant images. Unresolved records stay in review. A failed release validation leaves the current deployment usable. Publish a newer revision and confirm pantry, favourites and active recipe progress survive when their IDs are still valid.
- **Verify the actual Pages build.** Open a bookmarked recipe URL directly under the project base and refresh it. Test back navigation, image loading and unknown routes. Open the same catalogue on a fresh browser and verify pantry and cooking history stay on the device. Check Git history and the published artifact separately. Measure the performance budgets and walk through the cooking flow on a real phone before release.
