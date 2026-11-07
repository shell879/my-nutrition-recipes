# My Nutrition Recipes

Static-site conversion of DrinkRecipeStudio for a public menu experience.

## What this repo includes

- A static HTML/CSS/JS storefront that reads recipe data from `data.json`
- A separate `admin.html` maintenance page for editing categories and drinks
- Category filtering and text search
- Mobile-friendly cards with ingredient grouping for TOP/BOTTOM items
- Easy deployment to GitHub Pages, Cloudflare Pages, or Netlify

## Run locally

From the project root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

Open http://localhost:8000/admin.html to manage recipes. The admin page can load
the local `data.json` file or the same-origin `/api/data` endpoint. Changes can
be saved as a browser draft and downloaded as `data.json`; publish the
downloaded file to update the public menu. API loading is read-only until the
API supports authenticated writes. Configure the Cloudflare Worker route for
`shelldesignz.com/api/data` before selecting API mode.

Protect the admin URL with Cloudflare Access before sharing it. Do not rely on
the admin page itself for authentication.

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repository settings, enable GitHub Pages.
3. Choose the `main` branch and the root folder.
4. Point your custom domain to the GitHub Pages DNS records.

## Custom domain notes

This repo is intentionally static so you can connect a custom domain to a static host. For GitHub Pages, use:

- A record or CNAME to the GitHub Pages host
- A `CNAME` file in the repo root if you want the site to bind to a subdomain
