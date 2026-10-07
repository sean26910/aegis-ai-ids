from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from db import get_connection
from datetime import datetime
import joblib
from pathlib import Path
import numpy as np
import pandas as pd
from collections import Counter
import os
import json

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(
    app,
    cors_allowed_origins="*"
)

BASE_DIR = Path(__file__).resolve().parent.parent

MODEL_PATH = BASE_DIR / "models" / "hierarchical_ids_model.pkl"

TEST_DATA_PATH = BASE_DIR / "data" / "test_original.parquet"

test_df = pd.read_parquet(TEST_DATA_PATH)
ids_model = joblib.load(MODEL_PATH)

print("IDS 模型載入成功")
print("模型特徵數量：", len(ids_model["feature_columns"]))

@app.route("/", methods=["GET"])
def home():
    return "IDS Backend is running"


@app.route("/api/test-db", methods=["GET"])
def test_db():
    try:
        conn = get_connection()

        cursor = conn.cursor()

        cursor.execute("SELECT DATABASE();")

        database_name = cursor.fetchone()[0]

        cursor.close()
        conn.close()

        return jsonify({
            "success": True,
            "database": database_name
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route("/api/flows", methods=["POST"])
def add_flow():

    data = request.json

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    sql = """
    INSERT INTO flows(
        src_ip,
        dst_ip,
        src_port,
        dst_port,
        protocol,
        prediction
    )
    VALUES(%s,%s,%s,%s,%s,%s)
    """

    values = (
        data["src_ip"],
        data["dst_ip"],
        data["src_port"],
        data["dst_port"],
        data["protocol"],
        data["prediction"]
    )

    cursor.execute(sql, values)

    conn.commit()

    # 取得剛新增資料的 ID
    flow_id = cursor.lastrowid

    # 從 MySQL 把完整資料抓回來
    cursor.execute("""
        SELECT *
        FROM flows
        WHERE id = %s
    """, (flow_id,))

    flow_data = cursor.fetchone()

    # 格式化時間
    if flow_data["captured_at"]:
        flow_data["captured_at"] = flow_data["captured_at"].strftime(
            "%Y/%m/%d %H:%M"
        )

    cursor.close()
    conn.close()

    # 從資料庫取得最新統計
    stats = get_dashboard_stats()

    # WebSocket 送「資料庫實際保存的內容」
    socketio.emit(
        "new_flow",
        {
            "flow": flow_data,
            "stats": stats
        }
    )

    return jsonify({
        "success": True,
        "message": "Flow saved"
    })

@app.route("/api/dashboard", methods=["GET"])
def get_dashboard():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total FROM flows")
    total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) AS benign
        FROM flows
        WHERE prediction = 'BENIGN'
    """)
    benign = cursor.fetchone()["benign"]

    cursor.execute("""
        SELECT COUNT(*) AS attack
        FROM flows
        WHERE prediction != 'BENIGN'
    """)
    attack = cursor.fetchone()["attack"]

    cursor.close()
    conn.close()

    return jsonify({
        "total": total,
        "benign": benign,
        "attack": attack
    })

@app.route("/api/recent-flows", methods=["GET"])
def get_recent_flows():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT *
        FROM flows
        ORDER BY id DESC
        LIMIT 30
    """)

    flows = cursor.fetchall()

    for flow in flows:
        if flow["captured_at"]:
            flow["captured_at"] = flow["captured_at"].strftime(
                "%Y/%m/%d %H:%M"
            )

    cursor.close()
    conn.close()

    return jsonify(flows)

@app.route("/api/attack-stats", methods=["GET"])
def get_attack_stats():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            prediction,
            COUNT(*) AS total
        FROM flows
        WHERE prediction != 'BENIGN'
        GROUP BY prediction
    """)

    result = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(result)

@app.route("/api/recent-alerts", methods=["GET"])
def get_recent_alerts():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT *
        FROM flows
        WHERE prediction != 'BENIGN'
        ORDER BY id DESC
        LIMIT 30
    """)

    alerts = cursor.fetchall()

    for alert in alerts:
        if alert["captured_at"]:
            alert["captured_at"] = alert["captured_at"].strftime(
                "%Y/%m/%d %H:%M"
            )

    cursor.close()
    conn.close()

    return jsonify(alerts)

@app.route("/api/attack-history", methods=["GET"])
def get_attack_history():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT *
        FROM flows
        WHERE prediction != 'BENIGN'
        ORDER BY id DESC
    """)

    attacks = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(attacks)

@app.route("/api/traffic-stats", methods=["GET"])
def get_traffic_stats():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        SELECT
            DATE_FORMAT(captured_at, '%Y-%m-%d %H:%i:00') AS bucket_time,
            COUNT(*) AS total,
            SUM(
                CASE
                    WHEN prediction != 'BENIGN' THEN 1
                    ELSE 0
                END
            ) AS attack
        FROM flows
        WHERE captured_at >= NOW() - INTERVAL 30 MINUTE
        GROUP BY
            DATE_FORMAT(captured_at, '%Y-%m-%d %H:%i:00')
        ORDER BY bucket_time ASC
    """)

    result = cursor.fetchall()

    cursor.close()
    conn.close()

    return jsonify(result)

@app.route("/api/predict", methods=["POST"])
def predict():

    data = request.json

    features = data["features"]

    try:
        prediction = predict_flow(features)

        return jsonify({
            "success": True,
            "prediction": prediction
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def get_dashboard_stats():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) AS total FROM flows")
    total = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT COUNT(*) AS benign
        FROM flows
        WHERE prediction = 'BENIGN'
    """)
    benign = cursor.fetchone()["benign"]

    cursor.execute("""
        SELECT COUNT(*) AS attack
        FROM flows
        WHERE prediction != 'BENIGN'
    """)
    attack = cursor.fetchone()["attack"]

    cursor.close()
    conn.close()

    return {
        "total": total,
        "benign": benign,
        "attack": attack
    }

def enhanced_rf_predict(trees, X):
    if hasattr(X, "values"):
        X_input = X.values
    else:
        X_input = X

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

    return np.array(final_preds, dtype=int)

def predict_with_model(model_pack, X):

    pred_encoded = enhanced_rf_predict(
        model_pack["trees"],
        X
    )

    pred_label = model_pack[
        "label_encoder"
    ].inverse_transform(
        pred_encoded
    )

    return pred_label

def predict_flow(features):

    feature_columns = ids_model["feature_columns"]

    # 建立一列 DataFrame
    row = pd.DataFrame(
        [features],
        columns=feature_columns
    )

    # Stage 1
    s1 = predict_with_model(
        ids_model["stage1"],
        row
    )[0]

    if s1 == "BENIGN":
        return "BENIGN"

    # Stage 2
    s2 = predict_with_model(
        ids_model["stage2"],
        row
    )[0]

    if s2 == "Major Attack":

        prediction = predict_with_model(
            ids_model["stage2a"],
            row
        )[0]

    else:

        prediction = predict_with_model(
            ids_model["stage3"],
            row
        )[0]

    return prediction

def build_security_context():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM flows
            WHERE captured_at >= NOW() - INTERVAL 30 MINUTE
        """)
        total = cursor.fetchone()["total"]

        cursor.execute("""
            SELECT COUNT(*) AS benign
            FROM flows
            WHERE prediction = 'BENIGN'
              AND captured_at >= NOW() - INTERVAL 30 MINUTE
        """)
        benign = cursor.fetchone()["benign"]

        cursor.execute("""
            SELECT COUNT(*) AS attack
            FROM flows
            WHERE prediction != 'BENIGN'
              AND captured_at >= NOW() - INTERVAL 30 MINUTE
        """)
        attack = cursor.fetchone()["attack"]

        cursor.execute("""
            SELECT prediction, COUNT(*) AS total
            FROM flows
            WHERE prediction != 'BENIGN'
              AND captured_at >= NOW() - INTERVAL 30 MINUTE
            GROUP BY prediction
            ORDER BY total DESC
        """)
        rows = cursor.fetchall()
        distribution = {row["prediction"]: row["total"] for row in rows}

        top_attack = rows[0]["prediction"] if rows else None
        top_attack_count = rows[0]["total"] if rows else 0

        cursor.execute("""
            SELECT src_ip, dst_ip, src_port, dst_port, protocol, prediction, captured_at
            FROM flows
            WHERE prediction != 'BENIGN'
              AND captured_at >= NOW() - INTERVAL 30 MINUTE
            ORDER BY captured_at DESC
            LIMIT 10
        """)
        alerts = cursor.fetchall()
        for alert in alerts:
            if alert["captured_at"]:
                alert["captured_at"] = alert["captured_at"].strftime("%Y/%m/%d %H:%M:%S")

        attack_rate = round((attack / total) * 100, 2) if total > 0 else 0
        return {
            "time_range": "最近 30 分鐘",
            "traffic": {"total": total, "benign": benign, "attack": attack, "attack_rate": attack_rate},
            "top_attack": {"name": top_attack, "count": top_attack_count},
            "attack_distribution": distribution,
            "recent_alerts": alerts,
        }
    finally:
        cursor.close()
        conn.close()


@app.route("/api/ai-context", methods=["GET"])
def ai_context():
    try:
        return jsonify({
            "success": True,
            "security_context": build_security_context()
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai-analysis", methods=["POST"])
def ai_analysis():

    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        # 使用者可能從前端輸入的問題
        question = data.get(
            "question",
            "請分析目前的網路安全狀態"
        )

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # ==========================================
        # 1. 最近 30 分鐘總流量
        # ==========================================

        cursor.execute("""
            SELECT COUNT(*) AS total
            FROM flows
            WHERE captured_at >= NOW() - INTERVAL 30 MINUTE
        """)

        total = cursor.fetchone()["total"]


        # ==========================================
        # 2. 最近 30 分鐘正常流量
        # ==========================================

        cursor.execute("""
            SELECT COUNT(*) AS benign
            FROM flows
            WHERE
                prediction = 'BENIGN'
                AND captured_at >= NOW() - INTERVAL 30 MINUTE
        """)

        benign = cursor.fetchone()["benign"]


        # ==========================================
        # 3. 最近 30 分鐘異常流量
        # ==========================================

        cursor.execute("""
            SELECT COUNT(*) AS attack
            FROM flows
            WHERE
                prediction != 'BENIGN'
                AND captured_at >= NOW() - INTERVAL 30 MINUTE
        """)

        attack = cursor.fetchone()["attack"]


        # ==========================================
        # 4. 攻擊類型分布
        # ==========================================

        cursor.execute("""
            SELECT
                prediction,
                COUNT(*) AS total
            FROM flows
            WHERE
                prediction != 'BENIGN'
                AND captured_at >= NOW() - INTERVAL 30 MINUTE
            GROUP BY prediction
            ORDER BY total DESC
        """)

        attack_distribution_rows = cursor.fetchall()

        attack_distribution = {
            row["prediction"]: row["total"]
            for row in attack_distribution_rows
        }


        # ==========================================
        # 5. 主要威脅
        # ==========================================

        if len(attack_distribution_rows) > 0:
            top_attack = attack_distribution_rows[0]["prediction"]
            top_attack_count = attack_distribution_rows[0]["total"]
        else:
            top_attack = None
            top_attack_count = 0


        # ==========================================
        # 6. 最近 10 筆異常事件
        # ==========================================

        cursor.execute("""
            SELECT
                src_ip,
                dst_ip,
                src_port,
                dst_port,
                protocol,
                prediction,
                captured_at
            FROM flows
            WHERE
                prediction != 'BENIGN'
                AND captured_at >= NOW() - INTERVAL 30 MINUTE
            ORDER BY captured_at DESC
            LIMIT 10
        """)

        recent_alerts = cursor.fetchall()

        # datetime 不能直接安全地當成所有 LLM/API payload
        # 先統一轉成字串
        for alert in recent_alerts:
            if alert["captured_at"]:
                alert["captured_at"] = alert[
                    "captured_at"
                ].strftime("%Y/%m/%d %H:%M:%S")


        # ==========================================
        # 7. 異常比例
        # ==========================================

        if total > 0:
            attack_rate = round(
                (attack / total) * 100,
                2
            )
        else:
            attack_rate = 0


        # ==========================================
        # 8. 建立 Security Context
        # ==========================================

        security_context = {
            "time_range": "最近 30 分鐘",

            "traffic": {
                "total": total,
                "benign": benign,
                "attack": attack,
                "attack_rate": attack_rate
            },

            "top_attack": {
                "name": top_attack,
                "count": top_attack_count
            },

            "attack_distribution":
                attack_distribution,

            "recent_alerts":
                recent_alerts
        }


        # ==========================================
        # 9. 呼叫 OpenAI LLM 進行安全分析
        # ==========================================

        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError(
                "找不到 OPENAI_API_KEY，請確認 backend/.env 已正確設定"
            )

        system_prompt = """
你是 AegisAI 網路安全分析助手。

AegisAI 是一套機器學習網路入侵偵測系統。
攻擊分類結果已由階層式 Random Forest IDS 模型完成，
你不負責重新分類或修改 prediction。

你的工作：
1. 摘要目前網路安全狀態。
2. 解釋主要偵測到的威脅。
3. 指出值得注意的異常現象。
4. 提供後續調查與防禦建議。
5. 回答使用者與目前 IDS 資料相關的問題。

規則：
- 只能根據提供的 Security Context 分析。
- 不得捏造不存在的事件、IP、Port、Protocol、數量或攻擊類型。
- 不得修改 IDS 已產生的 prediction。
- 如果資料不足，必須明確說明資料不足。
- 如果最近 30 分鐘沒有偵測到異常，不得自行假設存在攻擊。
- 使用繁體中文回答。
- 回答保持簡潔、專業，適合顯示在資安監控平台。
"""

        user_prompt = f"""
以下是目前 AegisAI IDS 的 Security Context：

{json.dumps(security_context, ensure_ascii=False, indent=2)}

使用者問題：
{question}

請根據以上資料回答。
"""

        response = client.responses.create(
            model="gpt-5.6-luna",
            instructions=system_prompt,
            input=user_prompt
        )

        ai_response = response.output_text

        return jsonify({
            "success": True,
            "question": question,
            "security_context": security_context,
            "analysis": ai_response,
            "ai_connected": True
        })


    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()

# =========================
# 模型測試 - 取得資料類型
# =========================

@app.route("/api/model-test/types", methods=["GET"])
def get_model_test_types():

    labels = sorted(
        test_df["Label"]
        .dropna()
        .astype(str)
        .unique()
        .tolist()
    )

    return jsonify({
        "types": labels
    })


# =========================
# 模型測試 - 批次偵測
# =========================

@app.route("/api/model-test/batch", methods=["POST"])
def model_test_batch():

    try:
        data = request.get_json()

        attack_type = data.get("attack_type")
        count = int(data.get("count", 10))

        if not attack_type:
            return jsonify({
                "success": False,
                "error": "請選擇資料類型"
            }), 400

        if count < 1:
            return jsonify({
                "success": False,
                "error": "測試筆數至少為 1"
            }), 400

        # 防止一次測太多造成等待時間過長
        count = min(count, 1000)

        # 找出指定 Label
        selected = test_df[
            test_df["Label"].astype(str) == str(attack_type)
        ]

        if selected.empty:
            return jsonify({
                "success": False,
                "error": f"找不到 {attack_type} 的測試資料"
            }), 404

        # 最多取該類別實際擁有的數量
        sample_count = min(count, len(selected))

        # 隨機抽樣
        samples = selected.sample(
            n=sample_count
        )

        results = []

        prediction_counts = {}

        correct_count = 0

        for index, row in samples.iterrows():

            # 模型只拿 64 個 feature
            features = [
                row[column]
                for column in ids_model["feature_columns"]
            ]

            # 處理 numpy 型別
            features = [
                float(value)
                if pd.notna(value)
                else 0.0
                for value in features
            ]

            prediction = predict_flow(features)

            prediction = str(prediction)

            is_correct = prediction == str(attack_type)

            if is_correct:
                correct_count += 1

            prediction_counts[prediction] = (
                prediction_counts.get(prediction, 0) + 1
            )

            results.append({
                "id": len(results) + 1,
                "prediction": prediction,
                "correct": is_correct
            })

        accuracy = (
            correct_count / sample_count * 100
            if sample_count > 0
            else 0
        )

        return jsonify({
            "success": True,

            "attack_type": attack_type,

            "requested_count": count,

            "tested_count": sample_count,

            "correct_count": correct_count,

            "accuracy": round(accuracy, 2),

            "prediction_counts": prediction_counts,

            "results": results
        })

    except Exception as e:

        print("批次模型測試失敗：", e)

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def create_or_update_incident(
    cursor,
    attack_type,
    src_ip,
    dst_ip,
    dst_port,
    protocol
):
    # BENIGN 不建立異常事件
    if attack_type == "BENIGN":
        return None

    # 簡單風險分級
    high_risk_attacks = [
        "DDoS",
        "DoS Hulk",
        "DoS GoldenEye",
        "DoS slowloris",
        "DoS Slowhttptest",
        "Heartbleed",
        "Infiltration",
        "Web Attack - Sql Injection",
        "SQL Injection"
    ]

    medium_risk_attacks = [
        "PortScan",
        "FTP-Patator",
        "SSH-Patator",
        "Bot",
        "Web Attack - Brute Force",
        "Web Attack - XSS"
    ]

    if attack_type in high_risk_attacks:
        severity = "HIGH"
    elif attack_type in medium_risk_attacks:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    # ==========================================
    # 找是否已有相同「尚未處理」事件
    # ==========================================

    cursor.execute(
        """
        SELECT id
        FROM incidents
        WHERE attack_type = %s
          AND src_ip = %s
          AND dst_ip = %s
          AND dst_port = %s
          AND protocol = %s
          AND status != 'RESOLVED'
        ORDER BY id DESC
        LIMIT 1
        """,
        (
            attack_type,
            src_ip,
            dst_ip,
            dst_port,
            protocol
        )
    )

    existing = cursor.fetchone()

    # cursor 可能不是 dictionary cursor
    if existing:
        incident_id = (
            existing["id"]
            if isinstance(existing, dict)
            else existing[0]
        )

        cursor.execute(
            """
            UPDATE incidents
            SET
                event_count = event_count + 1,
                last_seen = NOW(),
                severity = %s
            WHERE id = %s
            """,
            (
                severity,
                incident_id
            )
        )

        return incident_id

    # ==========================================
    # 沒有 → 建立新的 Incident
    # ==========================================

    cursor.execute(
        """
        INSERT INTO incidents
        (
            attack_type,
            src_ip,
            dst_ip,
            dst_port,
            protocol,
            severity,
            status,
            event_count,
            first_seen,
            last_seen
        )
        VALUES
        (
            %s, %s, %s, %s, %s,
            %s, 'OPEN', 1, NOW(), NOW()
        )
        """,
        (
            attack_type,
            src_ip,
            dst_ip,
            dst_port,
            protocol,
            severity
        )
    )

    return cursor.lastrowid

# =========================
# Incident - 取得全部事件
# =========================

@app.route("/api/incidents", methods=["GET"])
def get_incidents():

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                id,
                attack_type,
                src_ip,
                dst_ip,
                dst_port,
                protocol,
                severity,
                status,
                event_count,
                first_seen,
                last_seen,
                created_at
            FROM incidents
            ORDER BY last_seen DESC
        """)

        incidents = cursor.fetchall()

        for incident in incidents:

            for field in [
                "first_seen",
                "last_seen",
                "created_at"
            ]:
                if incident.get(field):
                    incident[field] = incident[field].strftime(
                        "%Y/%m/%d %H:%M:%S"
                    )

        return jsonify(incidents)

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()

# =========================
# Incident - 修改狀態
# =========================

@app.route(
    "/api/incidents/<int:incident_id>/status",
    methods=["PATCH"]
)
def update_incident_status(incident_id):

    conn = None
    cursor = None

    try:

        data = request.get_json(silent=True) or {}

        status = data.get("status")

        allowed_status = [
            "OPEN",
            "INVESTIGATING",
            "RESOLVED"
        ]

        if status not in allowed_status:

            return jsonify({
                "success": False,
                "error": "無效的事件狀態"
            }), 400

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE incidents
            SET status = %s
            WHERE id = %s
            """,
            (
                status,
                incident_id
            )
        )

        conn.commit()

        if cursor.rowcount == 0:

            return jsonify({
                "success": False,
                "error": "找不到事件"
            }), 404

        socketio.emit(
            "incident_updated",
            {
                "id": incident_id,
                "status": status
            }
        )

        return jsonify({
            "success": True,
            "id": incident_id,
            "status": status
        })

    except Exception as e:

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()

# =========================
# Incident - 統計
# =========================

@app.route("/api/incidents/summary", methods=["GET"])
def get_incident_summary():

    conn = None
    cursor = None

    try:

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                COUNT(*) AS total,

                SUM(
                    CASE
                        WHEN status = 'OPEN'
                        THEN 1
                        ELSE 0
                    END
                ) AS open_count,

                SUM(
                    CASE
                        WHEN status = 'INVESTIGATING'
                        THEN 1
                        ELSE 0
                    END
                ) AS investigating_count,

                SUM(
                    CASE
                        WHEN status = 'RESOLVED'
                        THEN 1
                        ELSE 0
                    END
                ) AS resolved_count,

                SUM(
                    CASE
                        WHEN severity = 'HIGH'
                        AND status != 'RESOLVED'
                        THEN 1
                        ELSE 0
                    END
                ) AS high_risk_count

            FROM incidents
        """)

        result = cursor.fetchone()

        return jsonify({
            "total": result["total"] or 0,
            "open": result["open_count"] or 0,
            "investigating":
                result["investigating_count"] or 0,
            "resolved":
                result["resolved_count"] or 0,
            "high_risk":
                result["high_risk_count"] or 0
        })

    except Exception as e:

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:

        if cursor:
            cursor.close()

        if conn:
            conn.close()

@app.route("/api/traffic-sender/send", methods=["POST"])
def traffic_sender_send():
    conn = None
    cursor = None

    try:
        data = request.get_json()

        attack_type = data.get("attack_type")

        if not attack_type:
            return jsonify({
                "success": False,
                "error": "請選擇流量類型"
            }), 400

        # ==========================================
        # 1. 從 test_original.parquet 找指定類型
        # ==========================================

        selected = test_df[
            test_df["Label"].astype(str) == str(attack_type)
        ]

        if selected.empty:
            return jsonify({
                "success": False,
                "error": f"找不到 {attack_type} 的測試資料"
            }), 404

        # 隨機抽 1 筆
        row = selected.sample(n=1).iloc[0]

        # ==========================================
        # 2. 取模型需要的 64 個 Features
        # ==========================================

        features = [
            row[column]
            for column in ids_model["feature_columns"]
        ]

        features = [
            float(value) if pd.notna(value) else 0.0
            for value in features
        ]

        # ==========================================
        # 3. 階層式 RF 模型預測
        # ==========================================

        prediction = str(
            predict_flow(features)
        )

        # ==========================================
        # 4. 準備顯示用 Flow 資訊
        #
        # test_original.parquet 沒有完整原始 IP，
        # 所以 Sender 使用模擬 IP。
        # Destination Port 則使用資料集中的 feature。
        # ==========================================

        src_ip = "192.168.10.10"
        dst_ip = "192.168.10.20"

        dst_port = int(
            float(row.get("Destination Port", 0))
        )

        src_port = 0
        protocol = "TCP"

        # ==========================================
        # 5. 寫入 MySQL flows
        # ==========================================

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO flows
            (
                src_ip,
                dst_ip,
                src_port,
                dst_port,
                protocol,
                prediction
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                src_ip,
                dst_ip,
                src_port,
                dst_port,
                protocol,
                prediction
            )
        )

        conn.commit()

        flow_id = cursor.lastrowid

        # ==========================================
        # 6. 把剛新增的 Flow 讀回來
        # ==========================================

        cursor.close()

        cursor = conn.cursor(
            dictionary=True
        )

        cursor.execute(
            """
            SELECT *
            FROM flows
            WHERE id = %s
            """,
            (flow_id,)
        )

        flow_data = cursor.fetchone()

        # 時間格式轉成 Dashboard 使用格式
        if (
            flow_data
            and flow_data.get("captured_at")
        ):
            flow_data["captured_at"] = (
                flow_data["captured_at"].strftime(
                    "%Y/%m/%d %H:%M"
                )
            )

        # ==========================================
        # 7. 取得最新 Dashboard 統計
        # ==========================================

        stats = get_dashboard_stats()

        # ==========================================
        # 8. Socket.IO 通知 Dashboard
        # ==========================================

        socketio.emit(
            "new_flow",
            {
                "flow": flow_data,
                "stats": stats
            }
        )

        # ==========================================
        # 9. 回傳 Sender
        # ==========================================

        return jsonify({
            "success": True,

            "true_label": str(
                attack_type
            ),

            "prediction": prediction,

            "correct": (
                prediction ==
                str(attack_type)
            ),

            "flow": flow_data
        })

    except Exception as e:

        print(
            "Traffic Sender 發送失敗：",
            e
        )

        if conn:
            conn.rollback()

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    finally:

        if cursor:
            try:
                cursor.close()
            except:
                pass

        if conn:
            try:
                conn.close()
            except:
                pass

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=True
    )