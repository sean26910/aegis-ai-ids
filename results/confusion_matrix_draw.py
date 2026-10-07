import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path

# =========================
# Read Confusion Matrix
# =========================
BASE_DIR = Path(__file__).resolve().parent

cm_df = pd.read_csv(
    BASE_DIR / "hierarchical_enhanced_rf_confusion_matrix.csv",
    index_col=0
)

labels = cm_df.index.tolist()

cm = cm_df.values.astype(float)

# =========================
# Row Normalization
# =========================
cm = cm / cm.sum(axis=1, keepdims=True)

# =========================
# Plot
# =========================
fig, ax = plt.subplots(figsize=(13,11))

im = ax.imshow(
    cm,
    interpolation="nearest",
    cmap=plt.cm.Blues,
    vmin=0,
    vmax=1
)

cbar = plt.colorbar(im)
cbar.set_label("Probability", fontsize=13)

# =========================
# Axis
# =========================
ax.set_xticks(np.arange(len(labels)))
ax.set_yticks(np.arange(len(labels)))

ax.set_xticklabels(labels, fontsize=9)
ax.set_yticklabels(labels, fontsize=9)

plt.setp(
    ax.get_xticklabels(),
    rotation=45,
    ha="right"
)

ax.set_xlabel(
    "Predicted Label",
    fontsize=14,
    fontweight="bold"
)

ax.set_ylabel(
    "True Label",
    fontsize=14,
    fontweight="bold"
)

ax.set_title(
    "Normalized Confusion Matrix",
    fontsize=18,
    fontweight="bold"
)

# =========================
# Show Percentage
# =========================
threshold = 0.5

for i in range(cm.shape[0]):
    for j in range(cm.shape[1]):

        value = cm[i, j]

        # 小於0.1%不顯示
        if value < 0.001:
            continue

        ax.text(
            j,
            i,
            f"{value*100:.1f}%",
            ha="center",
            va="center",
            fontsize=8,
            color="white" if value > threshold else "black"
        )

plt.tight_layout()

plt.savefig(
    BASE_DIR / "normalized_confusion_matrix.png",
    dpi=600,
    bbox_inches="tight"
)

plt.show()