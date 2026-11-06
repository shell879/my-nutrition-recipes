# My Nutrition Recipes

Static-site conversion of DrinkRecipeStudio for a public menu experience.

## What this repo includes

- A static HTML/CSS/JS storefront that reads recipe data from `data.json`
- Category filtering and text search
- Mobile-friendly cards with ingredient grouping for TOP/BOTTOM items
- Easy deployment to GitHub Pages, Cloudflare Pages, or Netlify

## Run locally

From the project root:

```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repository settings, enable GitHub Pages.
3. Choose the `main` branch and the root folder.
4. Point your custom domain to the GitHub Pages DNS records.

## Custom domain notes

This repo is intentionally static so you can connect a custom domain to a static host. For GitHub Pages, use:

- A record or CNAME to the GitHub Pages host
- A `CNAME` file in the repo root if you want the site to bind to a subdomain

## Future path

This is the public/static foundation. The next step is to keep the admin/dashboard version separate from the public display version, then generate the final `data.json` file from a managed source.
