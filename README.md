# VisionAdapt

Marketing site + interactive product demo for VisionAdapt — a color-vision assessment and real-time correction tool for games.

Single-file, no build step: `index.html` contains all HTML/CSS/JS.

## Run locally

Just open `index.html` in a browser, or serve it:

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Push this repo to GitHub (see commands below).
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
3. Push to `main` — the included workflow (`.github/workflows/deploy.yml`) builds and deploys automatically.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`.

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main
```

No build tools, dependencies, or environment variables required — it's a static site.

## What changed in this version

- **Correction performance / Plate accuracy charts** were rebuilt with a shared, reusable chart renderer (`renderLineChart`) instead of one-off canvas code:
  - Y-axis gridlines with % labels, X-axis day labels
  - A real floating tooltip (day + value(s)) instead of the native browser title tooltip
  - A second "Simulated (uncorrected)" line on the Analytics page, matching the "Simulated vs corrected" label that was already in the UI copy but never actually rendered
  - Charts redraw correctly on window resize and on light/dark theme toggle (previously they didn't re-color on theme change)
