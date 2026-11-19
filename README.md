# My Nutrition Recipes

Static-site conversion of DrinkRecipeStudio for a public menu experience.

## What this repo includes

- A landing page at `/` with links to the public menu and recipe administration
- An HTML/CSS/JS storefront at `/callahannutrition` that reads recipe data from the same-origin `/api/data` endpoint
- A separate `/admin/` maintenance page for editing categories and drinks
- A `/Christmas/` admin page for the separate Christmas catalog
- A `/mynutrition/` inquiry page and `/mynutrition/admin/` editor with store switching
- Category filtering and text search
- Mobile-friendly cards with ingredient grouping for TOP/BOTTOM items
- Easy deployment to GitHub Pages, Cloudflare Pages, or Netlify

## Run locally

From the project root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

Open http://localhost:8000/callahannutrition to browse recipes or
http://localhost:8000/admin/ to manage them. The admin page can load
the local `data.json` file or the same-origin `/api/data` endpoint. Changes can
be saved to the API with a `POST` to `/api/data`, saved as a browser draft, or
downloaded as `data.json`; publish the downloaded file to update the public
menu when needed. The storefront and admin API mode both read from `/api/data`;
the API endpoint must support `GET` and `POST` with a JSON request body.
The older Christmas admin loads `christmas.json` in local mode. In API mode,
both that editor and MyNutrition use `/api/christmas`, so they show and edit
the same active-store data in KV; the endpoint name is historical. This store
data is separate only from the Callahan catalog served by `/api/data`.
MyNutrition also uses `/api/my-stores`, `/api/join-store`, and
`/api/switch-store` for store listing, joining, and switching.
Its recipe editor does not include image scanning or AI identification.
Configure Cloudflare Access for `/mynutrition/` and `/mynutrition/admin/`
before publishing those paths. The static pages do not receive Access identity
data; the Worker remains responsible for server-side identity context.
Keep the site-root `christmas.json` and the API repository's `christmas.json`
as import/local-data files only; editing either file does not update the live
KV store. For live API data, use either editor because both write the same
active store.
Edits in admin dialogs are staged in the page and do not call the API; use the
top-level “Save all to API” button once to submit the complete dataset.
Protect the admin URL and API with Cloudflare Access before sharing them; do
not rely on the admin page itself for authentication.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repository settings, enable GitHub Pages.
3. Choose the `main` branch and the root folder.
4. Point your custom domain to the GitHub Pages DNS records.

## Custom domain notes

This repo is intentionally static so you can connect a custom domain to a static host. For GitHub Pages, use:

- A record or CNAME to the GitHub Pages host
- A `CNAME` file in the repo root if you want the site to bind to a subdomain
