# VisionAdapt

Marketing site + interactive product demo for VisionAdapt — a color-vision assessment and real-time correction tool for games.

Single-file, no build step: `index.html` contains all HTML/CSS/JS. The one exception is the ML pipeline in `/ml`, which is a real offline training step whose output (trained weights) is embedded into `index.html` — see [Machine Learning](#machine-learning) below.

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

## Machine Learning

VisionAdapt's assessment flow (`computeResult()` in `index.html`) is powered by a real, trained ML pipeline — not an external AI API and not hardcoded rules.

| | |
|---|---|
| **What** | Two small feed-forward networks (12→16→16→3 axis classifier, 12→16→16→1 severity regressor), trained with scikit-learn, run client-side via TensorFlow.js |
| **Metrics** | 83.8% axis accuracy, 0.79 macro F1, severity MAE 16.7pts — all measured on a held-out test set, see [`ml/model/metrics.json`](ml/model/metrics.json) |
| **Data** | Synthetic, generated from documented CVD confusion-axis clinical mechanics — no real patient data (there isn't a source of that available to a project like this, and we're explicit about it rather than pretending otherwise) |
| **Inference** | 100% client-side, real `performance.now()` latency shown live in Analytics → Model Insights, with a disclosed rule-based fallback if TF.js can't load |

Full write-up, including the honest limitations and *why* the pipeline is
split into a model stage + a small rule stage instead of one end-to-end
classifier: **[`ml/docs/model_card.md`](ml/docs/model_card.md)**.
Architecture diagram: **[`ml/docs/architecture.md`](ml/docs/architecture.md)**.

To retrain:
```bash
cd ml/scripts
python3 generate_dataset.py   # regenerates dataset.npz
python3 train.py              # retrains, re-evaluates, re-exports model_weights.json + metrics.json
```
(Weights are also embedded inline in `index.html` for zero-dependency
offline operation — after retraining, re-embed by pasting the new
`ml/model/model_weights.json` into the `CVD_MODEL_WEIGHTS` constant.)

## What changed in this version

- **CVD Type & Severity model**: the assessment's scoring went from a hardcoded if/else rule block to a real trained ML pipeline (see above). The original rule logic is preserved as an explicitly-disclosed fallback, not deleted.
- **Color plate legibility**: fixed a bug where per-dot color jitter (±25% RGB toward black/white) was swamping the hue signal on near-isoluminant plate pairs, making some plates unreadable. Jitter now happens in HSL space at ±4.5% lightness, with denser/finer dots and larger glyphs.
- **Accessibility**: toggles, chip selectors, and sliders now expose proper `aria-label`/`aria-pressed`/`aria-valuetext`; the before/after compare handles (previously mouse/touch-only) are now keyboard-operable `role="slider"` elements; added a skip-to-content link.
- **Mobile layout**: fixed `minmax()` grid tracks that didn't shrink below their minimum on narrow viewports (the classic CSS Grid mobile-overflow bug), added wrap/shrink protection to flex rows that previously had none (demo toggle, compatibility rows, settings rows), and let the hero heading reflow naturally on small screens instead of fighting forced line breaks.
- **Correction performance / Plate accuracy charts** were rebuilt with a shared, reusable chart renderer (`renderLineChart`) instead of one-off canvas code:
  - Y-axis gridlines with % labels, X-axis day labels
  - A real floating tooltip (day + value(s)) instead of the native browser title tooltip
  - A second "Simulated (uncorrected)" line on the Analytics page, matching the "Simulated vs corrected" label that was already in the UI copy but never actually rendered
  - Charts redraw correctly on window resize and on light/dark theme toggle (previously they didn't re-color on theme change)

