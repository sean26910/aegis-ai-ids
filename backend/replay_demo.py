import time
import joblib
import requests
import pandas as pd
import numpy as np
from collections import Counter


# =========================
# 設定
# =========================

MODEL_PATH = "../models/hierarchical_ids_model.pkl"
TEST_PATH = "../data/test_original.parquet"

API_URL = "http://127.0.0.1:5000/api/flows"

# Demo 要送幾筆
DEMO_COUNT = 50

# 每筆間隔幾秒
SEND_INTERVAL = 0.5


# =========================
# 載入模型與測試資料
# =========================

print("載入模型...")

model = joblib.load(MODEL_PATH)

print("載入測試資料...")

df = pd.read_parquet(TEST_PATH)

feature_columns = model["feature_columns"]

print("模型與資料載入完成")
print("測試資料數量：", len(df))


# =========================
# Enhanced RF voting
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
# Hierarchical IDS
# =========================

def predict_flow(model, X):

    # Stage 1
    stage1_pred = predict_stage(
        model["stage1"],
        X
    )[0]

    if stage1_pred == "BENIGN":
        return "BENIGN"

    # Stage 2
    stage2_pred = predict_stage(
        model["stage2"],
        X
    )[0]

    # Major Attack
    if stage2_pred == "Major Attack":

        return predict_stage(
            model["stage2a"],
            X
        )[0]

    # Other Attack
    return predict_stage(
        model["stage3"],
        X
    )[0]


# =========================
# Demo Replay
# =========================

print()
print("============================")
print("開始 IDS Demo")
print("============================")
print()


for demo_index, (_, row) in enumerate(
    df.head(DEMO_COUNT).iterrows(),
    start=1
):

    # 取模型需要的 64 個 Feature
    X = pd.DataFrame(
        [row[feature_columns].values],
        columns=feature_columns
    )

    # 真實答案
    true_label = row["Label"]

    # 模型預測
    prediction = predict_flow(
        model,
        X
    )

    # Destination Port 是資料集真的有的
    dst_port = int(row["Destination Port"])

    # CICIDS2017 清理後資料沒有 IP / Protocol
    # Demo 階段先產生展示用 metadata
    payload = {
        "src_ip": f"192.168.1.{(demo_index % 200) + 1}",
        "dst_ip": "10.0.0.5",
        "src_port": 40000 + demo_index,
        "dst_port": dst_port,
        "protocol": "TCP",
        "prediction": prediction
    }

    try:

        response = requests.post(
            API_URL,
            json=payload,
            timeout=5
        )

        response.raise_for_status()

        correct = true_label == prediction

        result_mark = "✓" if correct else "✗"

        print(
            f"[{demo_index:03}] "
            f"真實: {true_label:<25} "
            f"預測: {prediction:<25} "
            f"{result_mark}"
        )

    except Exception as e:

        print(
            f"[{demo_index:03}] 傳送失敗：{e}"
        )

    time.sleep(SEND_INTERVAL)


print()
print("============================")
print("Demo 完成")
print("============================")