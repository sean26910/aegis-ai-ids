import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.neighbors import NearestNeighbors
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"

DATA_DIR.mkdir(exist_ok=True)

# =========================
# 1. 讀取資料
# =========================
df = pd.read_parquet(DATA_DIR / "clean_2017_baseline_aligned.parquet")

print("原始資料大小:", df.shape)

# =========================
# 2. 基本設定
# =========================
RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

drop_cols = [
    "Label",
    "Label_3class",
    "DatasetFamily",
    "SourceRelativePath"
]

feature_cols = [
    col for col in df.columns
    if col not in drop_cols
]

# =========================
# 3. 數值處理
# =========================
df[feature_cols] = df[feature_cols].apply(
    pd.to_numeric,
    errors="coerce"
)

df[feature_cols] = df[feature_cols].replace(
    [np.inf, -np.inf],
    np.nan
)

df[feature_cols] = df[feature_cols].fillna(
    df[feature_cols].median()
)

df[feature_cols] = df[feature_cols].fillna(0)

print("\nNaN / inf 處理完成")

# =========================
# 4. 先切割資料
# train : val : test = 70 : 15 : 15
# =========================
train_df, temp_df = train_test_split(
    df,
    test_size=0.3,
    random_state=RANDOM_STATE,
    shuffle=True,
    stratify=df["Label"]
)

val_df, test_df = train_test_split(
    temp_df,
    test_size=0.5,
    random_state=RANDOM_STATE,
    shuffle=True,
    stratify=temp_df["Label"]
)

print("\n切割後資料大小:")
print("Train:", train_df.shape)
print("Validation:", val_df.shape)
print("Test:", test_df.shape)

# =========================
# 5. 訓練集處理前分布
# =========================
print("\n==============================")
print("訓練集不平衡處理前 Label 分布")
print("==============================")
print(train_df["Label"].value_counts())

# =========================
# 6. 以 DoS GoldenEye 為補資料基準
# 小於 DoS GoldenEye 數量的攻擊類別，全補到 7205
# BENIGN 不處理
# =========================
train_label_counts = train_df["Label"].value_counts()

attack_counts_only = train_label_counts.drop(
    "BENIGN",
    errors="ignore"
)

TARGET_CLASS = "DoS GoldenEye"
TARGET_SIZE = 7205

print("\n補足基準類別:", TARGET_CLASS)
print("TARGET_SIZE:", TARGET_SIZE)

if TARGET_CLASS not in attack_counts_only.index:
    print("\n警告：訓練集中找不到 DoS GoldenEye")
else:
    print("訓練集中 DoS GoldenEye 數量:", attack_counts_only[TARGET_CLASS])

minority_attacks = attack_counts_only[
    attack_counts_only < TARGET_SIZE
]

print("\n需要做 K-means SMOTE 的攻擊類別:")
print(minority_attacks)

# =========================
# 7. K-means SMOTE
# =========================
synthetic_samples = []

for attack_name, count in minority_attacks.items():

    print("\n=========================")
    print("處理類別:", attack_name)

    attack_df = train_df[
        train_df["Label"] == attack_name
    ].copy()

    X = attack_df[feature_cols]

    if len(X) < 2:
        print("資料少於 2 筆，無法做 SMOTE，略過")
        continue

    n_needed = TARGET_SIZE - count

    print("原始數量:", count)
    print("目標數量:", TARGET_SIZE)
    print("需要生成:", n_needed)

    # -------------------------
    # 對該攻擊類別做標準化
    # -------------------------
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # -------------------------
    # K-means 分群
    # 避免資料太少卻分太多群
    # -------------------------
    n_clusters = min(5, max(1, len(X) // 2))

    kmeans = KMeans(
        n_clusters=n_clusters,
        random_state=RANDOM_STATE,
        n_init=10
    )

    clusters = kmeans.fit_predict(X_scaled)
    attack_df["cluster"] = clusters

    cluster_counts = attack_df["cluster"].value_counts()

    # -------------------------
    # 取得可用 cluster
    # cluster 內至少要有 2 筆資料
    # -------------------------
    valid_clusters = []

    for cluster_id, cluster_count in cluster_counts.items():

        cluster_df = attack_df[
            attack_df["cluster"] == cluster_id
        ]

        if len(cluster_df) < 2:
            print(f"Cluster {cluster_id} 只有 {len(cluster_df)} 筆，略過")
            continue

        valid_clusters.append((cluster_id, cluster_df))

    # 如果沒有可用 cluster，就改用整個類別
    if len(valid_clusters) == 0:
        print("沒有可用 cluster，改用整個類別生成")
        valid_clusters.append(("all", attack_df))

    # -------------------------
    # 平均分配生成數量
    # 確保總和剛好等於 n_needed
    # -------------------------
    base_generate = n_needed // len(valid_clusters)
    remainder = n_needed % len(valid_clusters)

    generated_count = 0

    for idx_cluster, (cluster_id, cluster_df) in enumerate(valid_clusters):

        X_cluster = cluster_df[feature_cols]

        cluster_scaler = StandardScaler()
        X_cluster_scaled = cluster_scaler.fit_transform(X_cluster)

        n_cluster_generate = base_generate

        if idx_cluster < remainder:
            n_cluster_generate += 1

        print(f"\nCluster {cluster_id}")
        print("cluster size:", len(X_cluster))
        print("generate:", n_cluster_generate)

        k_neighbors = min(
            5,
            len(X_cluster_scaled) - 1
        )

        nn = NearestNeighbors(
            n_neighbors=k_neighbors
        )

        nn.fit(X_cluster_scaled)

        for _ in range(n_cluster_generate):

            idx = np.random.randint(
                0,
                len(X_cluster_scaled)
            )

            xi = X_cluster_scaled[idx]

            distances, indices = nn.kneighbors([xi])

            neighbor_indices = indices[0]

            neighbors = X_cluster_scaled[
                neighbor_indices
            ]

            x_mean = np.mean(
                neighbors,
                axis=0
            )

            lam = np.random.rand()

            x_new = xi + lam * (x_mean - xi)

            x_new_original = cluster_scaler.inverse_transform(
                [x_new]
            )[0]

            sample_dict = dict(
                zip(feature_cols, x_new_original)
            )

            sample_dict["Label"] = attack_name
            sample_dict["Label_3class"] = "Other Attack"
            sample_dict["DatasetFamily"] = "cicids2017"
            sample_dict["SourceRelativePath"] = "synthetic"

            synthetic_samples.append(sample_dict)
            generated_count += 1

    print("\n實際生成:", generated_count)

    if generated_count != n_needed:
        print("警告：生成數量不等於需求數量")
        print("需要:", n_needed)
        print("實際:", generated_count)

# =========================
# 8. 合併 synthetic data 到訓練集
# =========================
synthetic_df = pd.DataFrame(synthetic_samples)

balanced_train_df = pd.concat(
    [train_df, synthetic_df],
    ignore_index=True
)

balanced_train_df = balanced_train_df.sample(
    frac=1,
    random_state=RANDOM_STATE
).reset_index(drop=True)

# =========================
# 9. 訓練集處理後分布
# =========================
print("\n==============================")
print("訓練集不平衡處理後 Label 分布")
print("==============================")
print(balanced_train_df["Label"].value_counts())

# =========================
# 10. 補齊檢查
# =========================
print("\n==============================")
print("補齊檢查")
print("==============================")

after_counts = balanced_train_df["Label"].value_counts()

for attack_name in minority_attacks.index:
    final_count = after_counts[attack_name]

    print(
        attack_name,
        "=>",
        final_count,
        "/",
        TARGET_SIZE,
        "OK" if final_count == TARGET_SIZE else "未補滿"
    )

print("\n==============================")
print("Validation 分布，不做 SMOTE")
print("==============================")
print(val_df["Label"].value_counts())

print("\n==============================")
print("Test 分布，不做 SMOTE")
print("==============================")
print(test_df["Label"].value_counts())

# =========================
# 11. 儲存資料
# =========================
balanced_train_df.to_parquet(
    DATA_DIR / "train_balanced_kmeans_smote_goldeneye_7205.parquet"
)

val_df.to_parquet(
    DATA_DIR / "val_original.parquet"
)

test_df.to_parquet(
    DATA_DIR / "test_original.parquet"
)

print("\n已輸出:")
print("train_balanced_kmeans_smote_goldeneye_7205.parquet")
print("val_original.parquet")
print("test_original.parquet")