# Architecture

## Offline (training — run once, not shipped to users)

```
generate_dataset.py                    train.py
┌─────────────────────┐   dataset.npz  ┌─────────────────────────┐
│ Simulate plate       │───────────────▶│ MLPClassifier (axis)     │
│ responses from       │                │ MLPRegressor (severity)  │
│ documented CVD        │                │ sklearn, Adam, early     │
│ confusion-axis        │                │ stopping                 │
│ mechanics             │                └────────────┬─────────────┘
└─────────────────────┘                              │
                                    metrics.json ◀────┤ evaluate on held-out test set
                                                       │
                              model_weights.json ◀────┘ export {W, b} per layer
```

## Online (in the browser — what ships)

```
 User completes assessment
          │
          ▼
 buildCvdFeatureVector()          12-dim vector: 8 plate outcomes
          │                        (-1/0/1) + 4-way one-hot confuse answer
          ▼
 CvdModel.predict()  ──────────▶  TensorFlow.js forward pass
          │                        (tf.matMul / tf.add / tf.relu / tf.softmax)
          │                        weights embedded inline, no fetch/CORS
          │                        real performance.now() latency
          ▼
 computeResultModel()             axis + severity (model) → subtype rule
          │                        (documented, ~15 lines, see model_card.md §2)
          ▼                              ▲
 state.profile updated                    │ if TF.js unavailable / throws
          │                              │
          └──────────────────▶ computeResultFallback()  (original rule logic,
                                          preserved unmodified, used only as
                                          a disclosed fallback — never
                                          silently substituted for a model
                                          prediction)
          │
          ▼
 Result screen shows type + severity + a badge disclosing which path ran
 Analytics → Model Insights shows held-out metrics + live inference latency
```

## Folder layout

```
visionadapt/
├── index.html                 site (unchanged UI/UX, model wired into computeResult())
├── ml/
│   ├── scripts/
│   │   ├── generate_dataset.py   synthetic data generator (documented methodology)
│   │   └── train.py              trains + evaluates + exports weights
│   ├── model/
│   │   ├── model_weights.json    exported {W, b} per layer (also embedded inline in index.html)
│   │   └── metrics.json          full held-out evaluation results
│   └── docs/
│       ├── model_card.md         model, dataset, I/O, pipeline, why, limitations, metrics
│       └── architecture.md       this file
├── README.md
└── .github/workflows/deploy.yml  GitHub Pages deploy, unchanged
```
