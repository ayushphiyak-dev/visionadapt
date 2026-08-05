"""
train.py
--------
Trains two small feed-forward networks on the synthetic dataset produced
by generate_dataset.py:

  1. type_classifier    — 12 -> 16 -> 16 -> 7 (softmax), predicts CVD type
  2. severity_regressor — 12 -> 16 -> 16 -> 1 (linear), predicts severity %

Both are sklearn MLPClassifier/MLPRegressor (real backprop, real
Adam-optimized training, real early stopping on a validation split) —
not a lookup table, not hardcoded thresholds.

After training, weights are exported to model_weights.json in a plain
{W, b} per-layer format so the browser can run inference with
TensorFlow.js tensor ops without needing the full tensorflowjs Python
converter toolchain.
"""
import json
import time
import numpy as np
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    confusion_matrix, mean_absolute_error, mean_squared_error
)

data = np.load('/home/claude/visionadapt/ml/scripts/dataset.npz')
X_train, ya_train, ys_train = data['X_train'], data['ya_train'], data['ys_train']
X_val, ya_val, ys_val = data['X_val'], data['ya_val'], data['ys_val']
X_test, ya_test, ys_test = data['X_test'], data['ya_test'], data['ys_test']

with open('/home/claude/visionadapt/ml/scripts/dataset_meta.json') as f:
    meta = json.load(f)
LABELS = meta['axis_labels']

# ---------------------------------------------------------------- classifier
clf = MLPClassifier(
    hidden_layer_sizes=(16, 16),
    activation='relu',
    solver='adam',
    alpha=1e-4,
    learning_rate_init=1e-3,
    max_iter=500,
    early_stopping=True,
    validation_fraction=0.15,
    n_iter_no_change=20,
    random_state=42,
)
t0 = time.time()
clf.fit(X_train, ya_train)
clf_train_time = time.time() - t0

yt_pred = clf.predict(X_test)
clf_acc = accuracy_score(ya_test, yt_pred)
prec, rec, f1, support = precision_recall_fscore_support(
    ya_test, yt_pred, average=None, labels=list(range(len(LABELS))), zero_division=0
)
macro_prec, macro_rec, macro_f1, _ = precision_recall_fscore_support(
    ya_test, yt_pred, average="macro", zero_division=0
)
cm = confusion_matrix(ya_test, yt_pred, labels=list(range(len(LABELS))))

# ----------------------------------------------------------------- regressor
reg = MLPRegressor(
    hidden_layer_sizes=(16, 16),
    activation='relu',
    solver='adam',
    alpha=1e-4,
    learning_rate_init=1e-3,
    max_iter=500,
    early_stopping=True,
    validation_fraction=0.15,
    n_iter_no_change=20,
    random_state=42,
)
t0 = time.time()
reg.fit(X_train, ys_train)
reg_train_time = time.time() - t0

ys_pred = reg.predict(X_test)
mae = mean_absolute_error(ys_test, ys_pred)
rmse = float(np.sqrt(mean_squared_error(ys_test, ys_pred)))

# ------------------------------------------------------------- CPU inference latency
# Measured on this machine's CPU as a reference point; the model card
# reports this alongside (not instead of) in-browser WebGL/WASM timing
# captured live by the app itself at runtime.
sample = X_test[:1]
n_reps = 500
t0 = time.time()
for _ in range(n_reps):
    clf.predict_proba(sample)
    reg.predict(sample)
single_inference_ms = (time.time() - t0) / n_reps * 1000

# --------------------------------------------------------------------- export
def export_mlp(model, is_classifier):
    layers = []
    for W, b in zip(model.coefs_, model.intercepts_):
        layers.append({'W': W.tolist(), 'b': b.tolist()})
    return {
        'layers': layers,
        'activation': 'relu',
        'output_activation': 'softmax' if is_classifier else 'linear',
        'n_layers': len(layers),
    }

export = {
    'axis_labels': LABELS,
    'plate_keys': meta['plate_keys'],
    'confuse_options': meta['confuse_options'],
    'feature_dim': meta['feature_dim'],
    'axis_classifier': export_mlp(clf, True),
    'severity_regressor': export_mlp(reg, False),
}
with open('/home/claude/visionadapt/ml/model/model_weights.json', 'w') as f:
    json.dump(export, f)

metrics = {
    'axis_classifier': {
        'accuracy': round(float(clf_acc), 4),
        'macro_precision': round(float(macro_prec), 4),
        'macro_recall': round(float(macro_rec), 4),
        'macro_f1': round(float(macro_f1), 4),
        'per_class': [
            {'label': LABELS[i], 'precision': round(float(prec[i]), 4),
             'recall': round(float(rec[i]), 4), 'f1': round(float(f1[i]), 4),
             'support': int(support[i])}
            for i in range(len(LABELS))
        ],
        'confusion_matrix': cm.tolist(),
        'train_time_sec': round(clf_train_time, 2),
        'n_iterations': int(clf.n_iter_),
    },
    'severity_regressor': {
        'mae': round(float(mae), 3),
        'rmse': round(float(rmse), 3),
        'train_time_sec': round(reg_train_time, 2),
        'n_iterations': int(reg.n_iter_),
    },
    'inference': {
        'cpu_single_sample_ms': round(single_inference_ms, 4),
        'measured_reps': n_reps,
        'note': 'Reference CPU timing from the training environment. The '
                'deployed app measures and displays real in-browser '
                'inference latency (TensorFlow.js, WebGL/WASM backend) '
                'at runtime — see the Model Insights panel.'
    },
    'dataset': {
        'n_train': meta['n_train'], 'n_val': meta['n_val'], 'n_test': meta['n_test'],
        'source': 'synthetic, generated from documented CVD confusion-axis '
                   'mechanics (see generate_dataset.py docstring). No real '
                   'patient data used.'
    }
}
with open('/home/claude/visionadapt/ml/model/metrics.json', 'w') as f:
    json.dump(metrics, f, indent=2)

print(json.dumps(metrics, indent=2))
