import pandas as pd
import joblib

df = pd.read_parquet("../data/test_original.parquet")

model = joblib.load("../models/hierarchical_ids_model.pkl")

print("=== test_original 欄位 ===")
for col in df.columns:
    print(col)

print("\n=== 模型需要的 feature ===")
for col in model["feature_columns"]:
    print(col)

print("\nTest shape:", df.shape)
print("Feature count:", len(model["feature_columns"]))