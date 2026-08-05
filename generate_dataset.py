"""
generate_dataset.py
--------------------
Builds the training data for the CVD Type & Severity classifier used in
VisionAdapt's assessment flow.

WHY SYNTHETIC DATA (read this before assuming this is "fake"):
VisionAdapt is a browser app with no clinical trial infrastructure, no IRB,
and no access to labeled patient records — and it shouldn't invent access
to any. Real Ishihara-plate response datasets tied to confirmed diagnoses
are not publicly available for this kind of use. So instead of skipping
ML or faking metrics on invented "real" data, we simulate plausible plate
responses using the actual, well-documented mechanics of color vision
deficiency:

  - Dichromats (-opia: protanopia, deuteranopia, tritanopia) reliably fail
    plates on their confusion axis and reliably pass plates on the other
    axis and the achromatic control plate.
  - Anomalous trichromats (-anomaly: protanomaly, deuteranomaly,
    tritanomaly) fail their axis *probabilistically*, with failure rate
    increasing with severity — this is the actual clinical distinction
    between "-anomaly" (partial) and "-opia" (complete) deficiency.
  - Self-reported color confusion is correlated with true axis but is
    noisy, because most people are bad at introspecting on their own
    color perception — that's *why* a plate test exists at all.

This makes the generated labels internally consistent with real CVD
mechanics (not just symmetric random noise), while being explicit that
no real patient data is used anywhere in this pipeline.

Feature vector (12 dims) — matches exactly what the live app can observe
from one assessment session:
  [0..7]  one entry per plate in PLATE_POOL (A..H), in fixed key order:
          -1 = not shown this session (app only samples 5 of 8 plates)
           0 = shown, answered incorrectly
           1 = shown, answered correctly
  [8..11] one-hot encoding of the self-reported "which colors do you
          confuse" answer: [Red/green, Blue/purple, Green/brown, Not sure]

Labels:
  y_type     -> one of 7 classes (see LABELS below)
  y_severity -> float in [0, 100]
"""
import numpy as np
import json

rng = np.random.default_rng(42)

PLATE_KEYS = ['plateA','plateB','plateC','plateD','plateE','plateF','plateG','plateH']
PLATE_AXIS = {
    'plateA':'redgreen','plateB':'redgreen','plateC':'redgreen','plateD':'redgreen',
    'plateE':'blueyellow','plateF':'blueyellow','plateG':'blueyellow',
    'plateH':'control',
}
CONFUSE_OPTIONS = ['Red / green', 'Blue / purple', 'Green / brown', "I'm not sure"]

LABELS = [
    'Typical color vision',
    'Protanomaly', 'Protanopia',
    'Deuteranomaly', 'Deuteranopia',
    'Tritanomaly', 'Tritanopia',
]
LABEL_TO_IDX = {l:i for i,l in enumerate(LABELS)}

# --------------------------------------------------------------------------
# The ML model predicts what plate-response patterns can *actually* support:
#   - AXIS_LABELS (3-class): which confusion axis, if any — this is the
#     signal the plates directly encode (redgreen vs blueyellow vs neither),
#     and is what genuinely differentiates the response pattern.
#   - severity (regression, 0-100)
#
# Distinguishing protan vs deutan, or anomaly (partial) vs opia (complete),
# from simple screening-plate right/wrong answers alone is not clinically
# reliable even in real ophthalmology — that distinction normally needs an
# anomaloscope, not an 8-plate screening set. So the fine-grained 7-class
# label shown in the UI is produced by a small, explicit, documented rule
# layered on top of the two real model outputs (axis from the classifier,
# severity from the regressor) plus the self-reported confusion answer —
# exactly the same "model output + clinical decision rule" pattern real
# diagnostic support tools use. See model_card.md, section "Why a hybrid
# pipeline instead of one end-to-end classifier".
AXIS_LABELS = ['Typical color vision', 'Red-green deficiency', 'Blue-yellow deficiency']
AXIS_TO_IDX = {l:i for i,l in enumerate(AXIS_LABELS)}

# Class prior used ONLY to balance the training set for stable learning.
# This is NOT a claim about real-world prevalence — true clinical
# prevalence (e.g. deuteranomaly ~5% of males, tritan types <0.01%) is
# wildly imbalanced and would starve the rarer classes of examples.
# Real prevalence is documented separately in the model card.
CLASS_PRIOR = {l: 1/len(LABELS) for l in LABELS}


def sample_severity(label):
    if label == 'Typical color vision':
        return float(np.clip(rng.normal(5, 4), 0, 20))
    if label.endswith('anomaly'):
        return float(np.clip(rng.normal(38, 14), 10, 65))
    # -opia (dichromatic / complete)
    return float(np.clip(rng.normal(80, 10), 55, 100))


def axis_of(label):
    if label == 'Typical color vision':
        return None
    if label.startswith('Prot') or label.startswith('Deut'):
        return 'redgreen'
    return 'blueyellow'


def p_correct(plate_axis, subject_axis, severity):
    """Probability the subject answers a given plate correctly."""
    if plate_axis == 'control':
        # Achromatic control plate is axis-independent; only very high
        # severity dichromats occasionally slip due to attention, not
        # perception, so keep this near-ceiling with a touch of noise.
        return 0.97
    if subject_axis is None:
        return 0.95  # typical vision, small human error rate
    if plate_axis != subject_axis:
        return 0.94  # orthogonal axis is basically unaffected
    # same axis as the deficiency: probability of failure rises with
    # severity, saturating near-certain failure for strong dichromats.
    return float(np.clip(1.0 - (severity/100)**1.15, 0.02, 0.95))


def sample_confuse_answer(subject_axis):
    if subject_axis == 'redgreen':
        return rng.choice(CONFUSE_OPTIONS, p=[0.52, 0.06, 0.30, 0.12])
    if subject_axis == 'blueyellow':
        return rng.choice(CONFUSE_OPTIONS, p=[0.08, 0.58, 0.09, 0.25])
    return rng.choice(CONFUSE_OPTIONS, p=[0.08, 0.05, 0.12, 0.75])


def generate(n):
    X = np.zeros((n, 12), dtype=np.float32)
    y_type = np.zeros(n, dtype=np.int64)      # 7-class, kept for analysis only
    y_axis = np.zeros(n, dtype=np.int64)       # 3-class, the actual ML target
    y_sev = np.zeros(n, dtype=np.float32)

    labels_arr = list(CLASS_PRIOR.keys())
    probs_arr = list(CLASS_PRIOR.values())

    for i in range(n):
        label = rng.choice(labels_arr, p=probs_arr)
        severity = sample_severity(label)
        axis = axis_of(label)

        # app shows 5 of the 8 plates, sampled without replacement
        shown = rng.choice(PLATE_KEYS, size=5, replace=False)
        for j, key in enumerate(PLATE_KEYS):
            if key not in shown:
                X[i, j] = -1.0
                continue
            pc = p_correct(PLATE_AXIS[key], axis, severity)
            X[i, j] = 1.0 if rng.random() < pc else 0.0

        confuse = sample_confuse_answer(axis)
        X[i, 8 + CONFUSE_OPTIONS.index(confuse)] = 1.0

        y_type[i] = LABEL_TO_IDX[label]
        y_axis[i] = {'redgreen':1,'blueyellow':2}.get(axis, 0)
        y_sev[i] = severity

    return X, y_type, y_axis, y_sev


if __name__ == '__main__':
    X_train, yt_train, ya_train, ys_train = generate(6000)
    X_val, yt_val, ya_val, ys_val = generate(1200)
    X_test, yt_test, ya_test, ys_test = generate(1200)

    np.savez('/home/claude/visionadapt/ml/scripts/dataset.npz',
             X_train=X_train, yt_train=yt_train, ya_train=ya_train, ys_train=ys_train,
             X_val=X_val, yt_val=yt_val, ya_val=ya_val, ys_val=ys_val,
             X_test=X_test, yt_test=yt_test, ya_test=ya_test, ys_test=ys_test)

    meta = {
        'labels': LABELS,
        'axis_labels': AXIS_LABELS,
        'plate_keys': PLATE_KEYS,
        'confuse_options': CONFUSE_OPTIONS,
        'n_train': len(X_train), 'n_val': len(X_val), 'n_test': len(X_test),
        'feature_dim': 12,
    }
    with open('/home/claude/visionadapt/ml/scripts/dataset_meta.json','w') as f:
        json.dump(meta, f, indent=2)

    print('Generated:', meta)
