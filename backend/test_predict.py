import pandas as pd
import joblib
import numpy as np
from collections import Counter


# =========================
# 載入模型與測試資料
# =========================

model = joblib.load("../models/hierarchical_ids_model.pkl")

df = pd.read_parquet("../data/test_original.parquet")

feature_columns = model["feature_columns"]

sample = df.iloc[[0]]

X = sample[feature_columns]

true_label = sample["Label"].values[0]


# =========================
# Enhanced RF 預測
# =========================

def enhanced_rf_predict(trees, X):

    X_input = X.values

    tree_preds = np.array([
        tree.predict(X_input)
        for tree in trees
    ]).T

    final_preds = []

    for row in tree_preds:

        vote = Counter(row)

        final_preds.append(
            vote.most_common(1)[0][0]
        )

    return np.array(final_preds)


# =========================
# 單一 Stage 預測
# =========================

def predict_stage(stage_model, X):

    pred_encoded = enhanced_rf_predict(
        stage_model["trees"],
        X
    )

    pred_label = stage_model[
        "label_encoder"
    ].inverse_transform(
        pred_encoded.astype(int)
    )

    return pred_label


# =========================
# 階層式 IDS 預測
# =========================

def predict_flow(model, X):

    # Stage 1
    stage1_pred = predict_stage(
        model["stage1"],
        X
    )[0]

    print("Stage1:", stage1_pred)

    if stage1_pred == "BENIGN":
        return "BENIGN"

    # Stage 2
    stage2_pred = predict_stage(
        model["stage2"],
        X
    )[0]

    print("Stage2:", stage2_pred)

    # Major Attack
    if stage2_pred == "Major Attack":

        final_pred = predict_stage(
            model["stage2a"],
            X
        )[0]

        print("Stage2A:", final_pred)

    # Other Attack
    else:

        final_pred = predict_stage(
            model["stage3"],
            X
        )[0]

        print("Stage3:", final_pred)

    return final_pred


# =========================
# 執行預測
# =========================

prediction = predict_flow(
    model,
    X
)

print()
print("=========================")
print("真實標籤：", true_label)
print("模型預測：", prediction)
print("=========================")