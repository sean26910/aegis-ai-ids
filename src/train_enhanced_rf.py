import pandas as pd
import numpy as np
import joblib

from collections import Counter
from joblib import Parallel, delayed

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix
)
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
RESULT_DIR = BASE_DIR / "results"

DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)


# =========================
# Enhanced RF predict
# =========================
def enhanced_rf_predict(trees, X, n_jobs=-1):
    tree_preds = Parallel(n_jobs=n_jobs)(
        delayed(tree.predict)(X) for tree in trees
    )

    tree_preds = np.array(tree_preds).T
    final_preds = []

    for row in tree_preds:
        vote = Counter(row)
        final_preds.append(vote.most_common(1)[0][0])

    return np.array(final_preds)


# =========================
# 評估單棵 tree
# =========================
def evaluate_tree(i, tree, X_val, y_val):
    pred = tree.predict(X_val)
    score = f1_score(
        y_val,
        pred,
        average="macro",
        zero_division=0
    )
    return i, score, pred


# =========================
# tree similarity
# =========================
def prediction_similarity(pred1, pred2):
    return np.mean(pred1 == pred2)


# =========================
# 1. 讀取資料
# =========================
train_df = pd.read_parquet(
    DATA_DIR / "train_balanced_kmeans_smote_goldeneye_7205.parquet"
)

val_df = pd.read_parquet(
    DATA_DIR / "val_original.parquet"
)

test_df = pd.read_parquet(
    DATA_DIR / "test_original.parquet"
)

print("Train:", train_df.shape)
print("Validation:", val_df.shape)
print("Test:", test_df.shape)

print("\nTrain Label 分布:")
print(train_df["Label"].value_counts())

print("\nValidation Label 分布:")
print(val_df["Label"].value_counts())

print("\nTest Label 分布:")
print(test_df["Label"].value_counts())


# =========================
# 2. Feature / Label
# =========================
drop_cols = [
    "Label",
    "Label_3class",
    "DatasetFamily",
    "SourceRelativePath"
]

feature_cols = [
    c for c in train_df.columns
    if c not in drop_cols
]

X_train = train_df[feature_cols]
X_val = val_df[feature_cols]
X_test = test_df[feature_cols]

label_encoder = LabelEncoder()
label_encoder.fit(
    pd.concat(
        [
            train_df["Label"],
            val_df["Label"],
            test_df["Label"]
        ],
        axis=0
    )
)

y_train = label_encoder.transform(train_df["Label"])
y_val = label_encoder.transform(val_df["Label"])
y_test = label_encoder.transform(test_df["Label"])

print("\nFeature 數量:", len(feature_cols))

print("\nLabel 對應表:")
for i, name in enumerate(label_encoder.classes_):
    print(i, "=>", name)


# =========================
# 3. 訓練 Random Forest
# =========================
rf = RandomForestClassifier(
    n_estimators=200,
    criterion="gini",
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features="sqrt",
    bootstrap=True,
    class_weight=None,
    random_state=42,
    n_jobs=-1,
    verbose=1
)

print("\n開始訓練 Random Forest...")
rf.fit(X_train, y_train)
print("Random Forest 訓練完成")


# =========================
# 4. 評估每棵 tree
# =========================
print("\n開始使用 Validation Set 評估每棵 tree...")

tree_info = Parallel(n_jobs=-1)(
    delayed(evaluate_tree)(i, tree, X_val, y_val)
    for i, tree in enumerate(rf.estimators_)
)

tree_info = sorted(
    tree_info,
    key=lambda x: x[1],
    reverse=True
)

print("\n前 10 棵 tree:")
for idx, score, _ in tree_info[:10]:
    print(f"Tree {idx}: macro F1 = {score:.4f}")


# =========================
# 5. 第一階段：保留表現較好的 tree
# =========================
KEEP_RATIO = 0.6
keep_num = int(len(tree_info) * KEEP_RATIO)

candidate_trees = tree_info[:keep_num]

print("\n第一階段保留 tree 數量:", len(candidate_trees))


# =========================
# 6. 第二階段：移除相似度太高的 tree
# =========================
SIM_THRESHOLD = 0.85

selected = []

for tree_idx, tree_score, tree_pred in candidate_trees:

    keep = True

    for selected_idx, selected_score, selected_pred in selected:

        sim = prediction_similarity(
            tree_pred,
            selected_pred
        )

        if sim >= SIM_THRESHOLD:
            keep = False
            break

    if keep:
        selected.append(
            (tree_idx, tree_score, tree_pred)
        )

selected_tree_indices = [
    idx for idx, _, _ in selected
]

selected_trees = [
    rf.estimators_[idx]
    for idx in selected_tree_indices
]

print(
    "\n第二階段 similarity optimization 後 tree 數量:",
    len(selected_trees)
)

if len(selected_trees) == 0:
    raise ValueError(
        "沒有選到任何 tree，請提高 SIM_THRESHOLD，例如改成 0.98 或 0.99"
    )


# =========================
# 7. Enhanced RF 預測
# =========================
print("\n開始 Enhanced RF 預測...")

y_pred_enhanced = enhanced_rf_predict(
    selected_trees,
    X_test,
    n_jobs=-1
)


# =========================
# 8. Enhanced RF 評估
# =========================
print("\n========== Enhanced Random Forest 評估結果 ==========")

enhanced_accuracy = accuracy_score(y_test, y_pred_enhanced)

enhanced_precision = precision_score(
    y_test,
    y_pred_enhanced,
    average="macro",
    zero_division=0
)

enhanced_recall = recall_score(
    y_test,
    y_pred_enhanced,
    average="macro",
    zero_division=0
)

enhanced_macro_f1 = f1_score(
    y_test,
    y_pred_enhanced,
    average="macro",
    zero_division=0
)

enhanced_weighted_f1 = f1_score(
    y_test,
    y_pred_enhanced,
    average="weighted",
    zero_division=0
)

print("Accuracy:", enhanced_accuracy)
print("Macro Precision:", enhanced_precision)
print("Macro Recall:", enhanced_recall)
print("Macro F1:", enhanced_macro_f1)
print("Weighted F1:", enhanced_weighted_f1)

enhanced_report = classification_report(
    y_test,
    y_pred_enhanced,
    target_names=label_encoder.classes_,
    zero_division=0,
    output_dict=True
)

enhanced_report_df = pd.DataFrame(
    enhanced_report
).transpose()

enhanced_report_df.to_csv(
    RESULT_DIR / "enhanced_rf_classification_report.csv",
    encoding="utf-8-sig"
)

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_enhanced,
    target_names=label_encoder.classes_,
    zero_division=0
))

enhanced_cm = confusion_matrix(
    y_test,
    y_pred_enhanced
)

enhanced_cm_df = pd.DataFrame(
    enhanced_cm,
    index=label_encoder.classes_,
    columns=label_encoder.classes_
)

enhanced_cm_df.to_csv(
    RESULT_DIR / "enhanced_rf_confusion_matrix.csv",
    encoding="utf-8-sig"
)


# =========================
# 9. 原始 RF 對照
# =========================
print("\n開始原始 RF 對照模型預測...")

y_pred_rf = rf.predict(X_test)

print("\n========== 原始 Random Forest 評估結果 ==========")

rf_accuracy = accuracy_score(y_test, y_pred_rf)

rf_precision = precision_score(
    y_test,
    y_pred_rf,
    average="macro",
    zero_division=0
)

rf_recall = recall_score(
    y_test,
    y_pred_rf,
    average="macro",
    zero_division=0
)

rf_macro_f1 = f1_score(
    y_test,
    y_pred_rf,
    average="macro",
    zero_division=0
)

rf_weighted_f1 = f1_score(
    y_test,
    y_pred_rf,
    average="weighted",
    zero_division=0
)

print("Accuracy:", rf_accuracy)
print("Macro Precision:", rf_precision)
print("Macro Recall:", rf_recall)
print("Macro F1:", rf_macro_f1)
print("Weighted F1:", rf_weighted_f1)

rf_report = classification_report(
    y_test,
    y_pred_rf,
    target_names=label_encoder.classes_,
    zero_division=0,
    output_dict=True
)

rf_report_df = pd.DataFrame(
    rf_report
).transpose()

rf_report_df.to_csv(
    RESULT_DIR / "rf_classification_report.csv",
    encoding="utf-8-sig"
)

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_rf,
    target_names=label_encoder.classes_,
    zero_division=0
))

rf_cm = confusion_matrix(
    y_test,
    y_pred_rf
)

rf_cm_df = pd.DataFrame(
    rf_cm,
    index=label_encoder.classes_,
    columns=label_encoder.classes_
)

rf_cm_df.to_csv(
    RESULT_DIR / "rf_confusion_matrix.csv",
    encoding="utf-8-sig"
)


# =========================
# 10. 整體結果比較輸出
# =========================
summary_df = pd.DataFrame({
    "Model": [
        "Random Forest",
        "Enhanced Random Forest"
    ],
    "Accuracy": [
        rf_accuracy,
        enhanced_accuracy
    ],
    "Macro Precision": [
        rf_precision,
        enhanced_precision
    ],
    "Macro Recall": [
        rf_recall,
        enhanced_recall
    ],
    "Macro F1": [
        rf_macro_f1,
        enhanced_macro_f1
    ],
    "Weighted F1": [
        rf_weighted_f1,
        enhanced_weighted_f1
    ],
    "Number of Trees": [
        len(rf.estimators_),
        len(selected_trees)
    ]
})

summary_df.to_csv(
    RESULT_DIR / "model_summary_results.csv",
    index=False,
    encoding="utf-8-sig"
)

print("\n========== 模型比較結果 ==========")
print(summary_df)


# =========================
# 11. 儲存模型
# =========================
joblib.dump(rf, MODEL_DIR / "random_forest_model.pkl")
joblib.dump(selected_trees, MODEL_DIR / "enhanced_rf_trees.pkl")
joblib.dump(feature_cols, MODEL_DIR / "feature_columns.pkl")
joblib.dump(label_encoder, MODEL_DIR / "label_encoder.pkl")

print("\n模型已儲存:")
print("random_forest_model.pkl")
print("enhanced_rf_trees.pkl")
print("feature_columns.pkl")
print("label_encoder.pkl")

print("\n結果檔案已輸出:")
print("model_summary_results.csv")
print("rf_classification_report.csv")
print("rf_confusion_matrix.csv")
print("enhanced_rf_classification_report.csv")
print("enhanced_rf_confusion_matrix.csv")