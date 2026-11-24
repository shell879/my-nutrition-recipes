# My Nutrition Recipes

Static-site conversion of DrinkRecipeStudio for a public menu experience.

## What this repo includes

- A landing page at `/` with links to the menu and recipe administration
- Main app pages include a Shell Designz Home link and context-specific navigation;
  slideshow navigation stays in its controls panel.
- A public `/recipe-builder/` introduction with instructions and a link to the
  Access-protected Recipe Builder at `/Christmas/`
- A public, static MyNutrition demo at `/demo/`, with fictional
  catalog data and an editor isolated from the real store APIs
- A neon slideshow at `/slideshow/` showing public store data or the
  selected MyNutrition catalog.
- Move notices at `/callahannutrition/` and `/admin/` point to the demo
- A `/Christmas/` admin page for the separate Christmas catalog
- Recipe Builder can scan recipes, suggest a recipe from a food photo or a
  typed dish name, and lets users review the result before saving.
- Recipe Builder recipe cards can open `/shop/` with the TOP entries of that
  recipe's TOP entries. BOTTOM instructions and recipe names are not passed.
  Amazon links suggest saved affiliate products whose names appear in ingredients and do not add
  items to a retailer cart. Walmart is not currently offered in the retailer selector.
- A `/mynutrition/` menu and `/mynutritionadmin/` editor with store switching
- Recipe Builder and MyNutrition Admin can delete empty categories; move their recipes first and
  use Save to persist the deletion.
- MyNutrition Admin's Flavor profiles panel supports adding, editing, and
  removing the selected store's flavor filters; use Save to persist changes.
- Category filtering and text search
- Mobile-friendly cards with ingredient grouping for TOP/BOTTOM items
- Easy deployment to GitHub Pages, Cloudflare Pages, or Netlify

## Run locally

From the project root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

Open http://localhost:8000/demo/ to try the demo. The website's default
`data.json` contains fictional example recipes and is publicly accessible;
do not publish private recipes in it. Replacing this file does not change the
separately stored API data. The demo reads only its fictional
`/demo/demo.json` and saves edits to browser local storage. Its
Reset demo button removes those saved edits. Store joining, sharing and switching
are not available in the demo; changes do not affect real stores.
If you previously saved demo edits, reset the demo to see updated examples;
resetting discards those saved edits.
The demo has its own catalog and editor scripts, derived from the production
pages; changes to production features are not automatically reflected in it.
The public shop accepts a versioned list of item names via same-origin session
storage and never loads store data or calls a shopping API. The handoff is
consumed when the shop opens; additional ingredients can be added to check for
product suggestions and remain on that page until it is closed or reloaded.
Ingredients already displayed cannot be edited on the shop page. A blocked pop-up or unavailable browser storage is reported in Recipe
Builder. Amazon suggests saved affiliate products when their names appear as
whole words in an ingredient, ignoring capitalization and simple plural forms.
The most specific matching name is preferred; if several equally specific
products match, choose from the product picks instead. Suggestions can differ
from the recipe and should be checked before purchase. Future
sources such as MyNutrition must select their own ingredients before handing
the list to the shop; TOP and BOTTOM have different meanings in the two apps.
The protected Store Management page edits a global list of Amazon product
names, categories and SiteStripe URLs. The shop groups picks into Ingredients,
Kitchen supplies, and, when needed, Uncategorized. Older products without a
category remain Uncategorized until edited. Store Management supports editable
categories; categories with products appear as expandable panels on the public shop.
Original categories can be renamed, while custom categories can also be removed;
their products then become Uncategorized. The original Kitchen supplies category
is excluded from recipe ingredient suggestions; custom categories are eligible.
Save products persists the entire list and categories. Deploy the updated Worker
before deploying the website.
Saving publishes the product list via the
read-only `/api/data/shop/products` endpoint. Walmart search code is retained
but is not exposed in the retailer selector.
Use SiteStripe links to specific Amazon product pages, not search pages.
Use **Add starter products** to stage the included examples without replacing
existing links, then select **Save products** to publish them.
KV changes can take time to appear, and simultaneous edits can overwrite each
other. For local testing, serve the site and run `wrangler dev` on port 8787.
The Recipe Builder editor loads `christmas.json` in local mode. In API mode,
Recipe Builder and MyNutrition use `/api/christmas` with separate app-specific
store lists and active selections. MyNutrition's menu and admin share its
stores. Existing stores are assigned to Recipe Builder; the first MyNutrition
visit creates a separate empty store. Store numbers cannot be joined across apps.
MyNutrition also uses `/api/my-stores`, `/api/join-store`, and
`/api/switch-store` for store listing, joining, and switching.
The Christmas and MyNutrition editors offer **Share Number** in the album/store
panel only for the user's own store, using the active ID returned by `/api/my-stores`. Someone who signs in
can enter that number using **Join**. Share only with trusted people: the
current join endpoint has no invitation or approval check, and shared access
may include editing. A local browser draft has no shareable API store number.
Its recipe editor does not include image scanning or AI identification.
The home page links to the MyNutrition menu and its separate admin page.
Configure distinct Cloudflare Access policies for `/mynutrition/` and
`/mynutritionadmin/` before publishing. The static pages do not receive Access
identity data; the Worker uses the authenticated identity to load an existing
store or initialize an empty store for a first-time user.
Keep the site-root `christmas.json` and the API repository's `christmas.json`
as import/local-data files only; editing either file does not update the live
KV store. For live API data, use the editor for the relevant app.
Edits in admin dialogs are staged in the page and do not call the API; use the
top-level “Save all to API” button once to submit the complete dataset.
Protect the real admin pages and APIs with Cloudflare Access; do not rely on
the pages themselves for authentication. Retiring the legacy `/admin/` page
does not disable or remove its `/api/data` endpoint or stored data. Keep that
endpoint protected or disable it separately.

## Search visibility

The public Recipe Builder introduction explains the app without exposing user
recipes or AI tools. The editor and API must remain protected by Cloudflare
Access, so search engines cannot index the editor's private content. Keep
`robots.txt` and `sitemap.xml` available at the site root; the sitemap lists
only the public home and introduction pages. Submit the sitemap in Google
Search Console after deployment. Indexing and search rankings are not guaranteed.

## Deploy to GitHub Pages

Before sharing the demo, configure Cloudflare Access to allow public access to
`/demo/` and its assets. To make the legacy move notices visible without signing
in, allow access to `/callahannutrition/`, `/callahannutrition/editor.html`,
`/admin/`, and `/admin.html` as well. Verify overlapping policies.
Keep the real MyNutrition pages and all private APIs (including `/api/data`)
protected, and test the demo in a signed-out browser.
Allow unauthenticated access to `/shop/`, its assets, and the read-only
`/api/data/shop/products` endpoint as well, and test it
from both the protected Recipe Builder and a signed-out browser. Do not expose
`/api/data` or `/api/christmas` to make the static shop public. Any future
retailer API or affiliate links need their own access and policy review.
The public MyNutrition guide's request form also requires public POST access to
the exact `/api/data/access-requests` route. Keep its listing and removal API
under `/api/store-management/*` protected. The form collects an email address;
it does not send an email or grant access. Review requests in Store Management
and contact people manually. No automated spam protection is included.
The single KV JSON list is eventually consistent; concurrent submissions and
removals can overwrite or restore requests.

1. Push this repo to GitHub.
2. In the repository settings, enable GitHub Pages.
3. Choose the `main` branch and the root folder.
4. Point your custom domain to the GitHub Pages DNS records.

## Custom domain notes

This repo is intentionally static so you can connect a custom domain to a static host. For GitHub Pages, use:

- A record or CNAME to the GitHub Pages host
- A `CNAME` file in the repo root if you want the site to bind to a subdomain
