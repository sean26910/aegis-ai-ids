import pandas as pd
import numpy as np
import joblib

from pathlib import Path
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


# =========================
# 路徑設定
# =========================
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
MODEL_DIR = BASE_DIR / "models"
RESULT_DIR = BASE_DIR / "results"

DATA_DIR.mkdir(exist_ok=True)
MODEL_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)


# =========================
# 基本設定
# =========================
drop_cols = [
    "Label",
    "Label_3class",
    "DatasetFamily",
    "SourceRelativePath"
]

major_attacks = [
    "DDoS",
    "DoS GoldenEye",
    "DoS Hulk",
    "DoS Slowhttptest",
    "DoS slowloris",
    "PortScan"
]


# =========================
# Enhanced RF predict
# =========================
def enhanced_rf_predict(trees, X, n_jobs=-1):
    """
    使用篩選後的多棵 Decision Tree 做投票預測
    """

    if hasattr(X, "values"):
        X_input = X.values
    else:
        X_input = X

    tree_preds = Parallel(n_jobs=n_jobs)(
        delayed(tree.predict)(X_input) for tree in trees
    )

    tree_preds = np.array(tree_preds).T

    final_preds = []

    for row in tree_preds:
        vote = Counter(row)
        final_preds.append(vote.most_common(1)[0][0])

    # 關鍵：轉回 int
    return np.array(final_preds, dtype=int)


def evaluate_tree(i, tree, X_val, y_val):
    """
    評估單棵 tree 的 Macro F1
    """

    if hasattr(X_val, "values"):
        X_input = X_val.values
    else:
        X_input = X_val

    pred = tree.predict(X_input)

    score = f1_score(
        y_val,
        pred,
        average="macro",
        zero_division=0
    )

    return i, score, pred


def double_fault(y_true, pred1, pred2):
    """
    Double Fault Diversity

    兩棵 tree 同時預測錯的比例越高，
    代表這兩棵 tree 的錯誤模式越像，
    diversity 越低。
    """

    both_wrong = np.logical_and(
        pred1 != y_true,
        pred2 != y_true
    )

    return np.mean(both_wrong)


# =========================
# 訓練 Enhanced RF function
# =========================
def train_enhanced_rf_model(
    model_name,
    X_train,
    y_train_raw,
    X_val,
    y_val_raw,
    keep_ratio=0.6,
    double_fault_threshold=0.02,
    n_estimators=200,
    min_trees=20
):
    print(f"\n========== 開始訓練 {model_name} ==========")

    label_encoder = LabelEncoder()
    y_train = label_encoder.fit_transform(y_train_raw)
    y_val = label_encoder.transform(y_val_raw)

    print("\nLabel 對應表:")
    for i, name in enumerate(label_encoder.classes_):
        print(i, "=>", name)

    rf = RandomForestClassifier(
        n_estimators=n_estimators,
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

    rf.fit(X_train, y_train)

    print(f"\n{model_name} Random Forest 訓練完成")
    print("開始評估每棵 tree...")

    tree_info = Parallel(n_jobs=-1)(
        delayed(evaluate_tree)(i, tree, X_val, y_val)
        for i, tree in enumerate(rf.estimators_)
    )

    tree_info = sorted(
        tree_info,
        key=lambda x: x[1],
        reverse=True
    )

    keep_num = int(len(tree_info) * keep_ratio)
    candidate_trees = tree_info[:keep_num]

    print("第一階段保留 tree 數量:", len(candidate_trees))

    selected = []

    for tree_idx, tree_score, tree_pred in candidate_trees:
        keep = True

        for _, _, selected_pred in selected:
            df_score = double_fault(
                y_val,
                tree_pred,
                selected_pred
            )

            if df_score >= double_fault_threshold:
                keep = False
                break

        if keep:
            selected.append(
                (tree_idx, tree_score, tree_pred)
            )

    # 避免 diversity 條件太嚴格導致 tree 太少
    if len(selected) < min_trees:
        print(
            f"Double Fault 篩選後 tree 太少，目前只有 {len(selected)} 棵，"
            f"自動補到至少 {min_trees} 棵"
        )

        selected_indices = set(idx for idx, _, _ in selected)

        for tree_idx, tree_score, tree_pred in candidate_trees:
            if len(selected) >= min_trees:
                break

            if tree_idx not in selected_indices:
                selected.append(
                    (tree_idx, tree_score, tree_pred)
                )
                selected_indices.add(tree_idx)

    selected_tree_indices = [idx for idx, _, _ in selected]
    selected_trees = [
        rf.estimators_[idx]
        for idx in selected_tree_indices
    ]

    print("Double Fault optimization 後 tree 數量:", len(selected_trees))

    if len(selected_trees) == 0:
        raise ValueError(
            f"{model_name} 沒有選到任何 tree，請提高 double_fault_threshold"
        )

    return {
        "name": model_name,
        "rf": rf,
        "trees": selected_trees,
        "label_encoder": label_encoder,
        "selected_tree_indices": selected_tree_indices,
        "keep_ratio": keep_ratio,
        "double_fault_threshold": double_fault_threshold
    }


# =========================
# 載入資料
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

feature_cols = [
    c for c in train_df.columns
    if c not in drop_cols
]

X_train_all = train_df[feature_cols]
X_val_all = val_df[feature_cols]
X_test = test_df[feature_cols]

y_test_true = test_df["Label"].values


# =========================
# Stage 1：BENIGN vs Attack
# =========================
train_stage1_label = train_df["Label"].apply(
    lambda x: "BENIGN" if x == "BENIGN" else "Attack"
)

val_stage1_label = val_df["Label"].apply(
    lambda x: "BENIGN" if x == "BENIGN" else "Attack"
)

stage1_model = train_enhanced_rf_model(
    "Stage1_Benign_vs_Attack",
    X_train_all,
    train_stage1_label,
    X_val_all,
    val_stage1_label,
    keep_ratio=0.6,
    double_fault_threshold=0.02,
    min_trees=20
)


# =========================
# Stage 2：Major Attack vs Other Attack
# =========================
train_attack_df = train_df[
    train_df["Label"] != "BENIGN"
].copy()

val_attack_df = val_df[
    val_df["Label"] != "BENIGN"
].copy()

X_train_stage2 = train_attack_df[feature_cols]
X_val_stage2 = val_attack_df[feature_cols]

train_stage2_label = train_attack_df["Label"].apply(
    lambda x: "Major Attack" if x in major_attacks else "Other Attack"
)

val_stage2_label = val_attack_df["Label"].apply(
    lambda x: "Major Attack" if x in major_attacks else "Other Attack"
)

stage2_model = train_enhanced_rf_model(
    "Stage2_Major_vs_Other",
    X_train_stage2,
    train_stage2_label,
    X_val_stage2,
    val_stage2_label,
    keep_ratio=0.6,
    double_fault_threshold=0.02,
    min_trees=20
)


# =========================
# Stage 2A：Major Attack 細分類
# =========================
train_major_df = train_df[
    train_df["Label"].isin(major_attacks)
].copy()

val_major_df = val_df[
    val_df["Label"].isin(major_attacks)
].copy()

X_train_major = train_major_df[feature_cols]
X_val_major = val_major_df[feature_cols]

stage2a_model = train_enhanced_rf_model(
    "Stage2A_Major_Attack_Classifier",
    X_train_major,
    train_major_df["Label"],
    X_val_major,
    val_major_df["Label"],
    keep_ratio=0.6,
    double_fault_threshold=0.02,
    min_trees=20
)


# =========================
# Stage 3：Other Attack 細分類
# =========================
train_other_df = train_df[
    (train_df["Label"] != "BENIGN") &
    (~train_df["Label"].isin(major_attacks))
].copy()

val_other_df = val_df[
    (val_df["Label"] != "BENIGN") &
    (~val_df["Label"].isin(major_attacks))
].copy()

X_train_other = train_other_df[feature_cols]
X_val_other = val_other_df[feature_cols]

stage3_model = train_enhanced_rf_model(
    "Stage3_Other_Attack_Classifier",
    X_train_other,
    train_other_df["Label"],
    X_val_other,
    val_other_df["Label"],
    keep_ratio=0.6,
    double_fault_threshold=0.02,
    min_trees=20
)


# =========================
# 階層式預測
# =========================
def predict_with_model(model_pack, X):
    pred_encoded = enhanced_rf_predict(
        model_pack["trees"],
        X,
        n_jobs=-1
    )

    pred_label = model_pack["label_encoder"].inverse_transform(
        pred_encoded
    )

    return pred_label


print("\n========== 開始 Hierarchical Enhanced RF 預測 ==========")

final_preds = []

stage1_pred = predict_with_model(stage1_model, X_test)

for idx, s1 in enumerate(stage1_pred):

    row_X = X_test.iloc[[idx]]

    if s1 == "BENIGN":
        final_preds.append("BENIGN")
        continue

    s2 = predict_with_model(stage2_model, row_X)[0]

    if s2 == "Major Attack":
        final_label = predict_with_model(stage2a_model, row_X)[0]
        final_preds.append(final_label)
    else:
        final_label = predict_with_model(stage3_model, row_X)[0]
        final_preds.append(final_label)

final_preds = np.array(final_preds)


# =========================
# 評估 Hierarchical Enhanced RF
# =========================
all_labels = sorted(train_df["Label"].unique())

print("\n========== Hierarchical Enhanced RF 評估結果 ==========")

accuracy = accuracy_score(y_test_true, final_preds)

macro_precision = precision_score(
    y_test_true,
    final_preds,
    labels=all_labels,
    average="macro",
    zero_division=0
)

macro_recall = recall_score(
    y_test_true,
    final_preds,
    labels=all_labels,
    average="macro",
    zero_division=0
)

macro_f1 = f1_score(
    y_test_true,
    final_preds,
    labels=all_labels,
    average="macro",
    zero_division=0
)

weighted_f1 = f1_score(
    y_test_true,
    final_preds,
    labels=all_labels,
    average="weighted",
    zero_division=0
)

print("Accuracy:", accuracy)
print("Macro Precision:", macro_precision)
print("Macro Recall:", macro_recall)
print("Macro F1:", macro_f1)
print("Weighted F1:", weighted_f1)

print("\nClassification Report:")
print(classification_report(
    y_test_true,
    final_preds,
    labels=all_labels,
    zero_division=0
))

report = classification_report(
    y_test_true,
    final_preds,
    labels=all_labels,
    zero_division=0,
    output_dict=True
)

report_df = pd.DataFrame(report).transpose()

report_df.to_csv(
    RESULT_DIR / "hierarchical_enhanced_rf_classification_report.csv",
    encoding="utf-8-sig"
)

cm = confusion_matrix(
    y_test_true,
    final_preds,
    labels=all_labels
)

cm_df = pd.DataFrame(
    cm,
    index=all_labels,
    columns=all_labels
)

cm_df.to_csv(
    RESULT_DIR / "hierarchical_enhanced_rf_confusion_matrix.csv",
    encoding="utf-8-sig"
)

summary_df = pd.DataFrame({
    "Model": ["Hierarchical Enhanced Random Forest"],
    "Accuracy": [accuracy],
    "Macro Precision": [macro_precision],
    "Macro Recall": [macro_recall],
    "Macro F1": [macro_f1],
    "Weighted F1": [weighted_f1],
    "Stage1 Trees": [len(stage1_model["trees"])],
    "Stage2 Trees": [len(stage2_model["trees"])],
    "Stage2A Trees": [len(stage2a_model["trees"])],
    "Stage3 Trees": [len(stage3_model["trees"])],
    "Keep Ratio": [0.6],
    "Double Fault Threshold": [0.02]
})

summary_df.to_csv(
    RESULT_DIR / "hierarchical_enhanced_rf_summary.csv",
    index=False,
    encoding="utf-8-sig"
)

print("\n結果檔案已輸出:")
print(RESULT_DIR / "hierarchical_enhanced_rf_summary.csv")
print(RESULT_DIR / "hierarchical_enhanced_rf_classification_report.csv")
print(RESULT_DIR / "hierarchical_enhanced_rf_confusion_matrix.csv")


# =========================
# 儲存模型
# =========================
joblib.dump(
    stage1_model,
    MODEL_DIR / "stage1_benign_attack_model.pkl"
)

joblib.dump(
    stage2_model,
    MODEL_DIR / "stage2_major_other_model.pkl"
)

joblib.dump(
    stage2a_model,
    MODEL_DIR / "stage2a_major_classifier_model.pkl"
)

joblib.dump(
    stage3_model,
    MODEL_DIR / "stage3_other_classifier_model.pkl"
)

joblib.dump(
    feature_cols,
    MODEL_DIR / "hierarchical_feature_columns.pkl"
)

hierarchical_ids_model = {
    "stage1": stage1_model,
    "stage2": stage2_model,
    "stage2a": stage2a_model,
    "stage3": stage3_model,
    "feature_columns": feature_cols,
    "major_attacks": major_attacks
}

joblib.dump(
    hierarchical_ids_model,
    MODEL_DIR / "hierarchical_ids_model.pkl"
)

print("\n模型已儲存:")
print(MODEL_DIR / "hierarchical_ids_model.pkl")
print(MODEL_DIR / "stage1_benign_attack_model.pkl")
print(MODEL_DIR / "stage2_major_other_model.pkl")
print(MODEL_DIR / "stage2a_major_classifier_model.pkl")
print(MODEL_DIR / "stage3_other_classifier_model.pkl")
print(MODEL_DIR / "hierarchical_feature_columns.pkl")