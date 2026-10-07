import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:5000";

function App() {
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");

  const [count, setCount] = useState(10);
  const [interval, setIntervalValue] = useState(500);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [sent, setSent] = useState(0);
  const [error, setError] = useState("");

  // ==========================================
  // 取得可發送的流量類型
  // ==========================================

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/model-test/types`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "取得流量類型失敗"
          );
        }

        const labels = data.types || [];

        setTypes(labels);

        if (labels.length > 0) {
          setSelectedType(labels[0]);
        }
      } catch (err) {
        console.error(err);

        setError(
          "無法連線至 IDS Backend"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTypes();
  }, []);

  // ==========================================
  // Delay
  // ==========================================

  const sleep = (ms) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };

  // ==========================================
  // 開始發送
  // ==========================================

  const startSending = async () => {
    const total = Number(count);
    const delay = Number(interval);

    if (!selectedType) {
      setError("請選擇流量類型");
      return;
    }

    if (!Number.isInteger(total) || total < 1) {
      setError("發送數量必須至少為 1");
      return;
    }

    if (total > 1000) {
      setError("單次最多發送 1000 筆");
      return;
    }

    if (
      Number.isNaN(delay) ||
      delay < 0
    ) {
      setError("發送間隔不能小於 0");
      return;
    }

    setSending(true);
    setSent(0);
    setError("");

    try {
      for (let i = 0; i < total; i++) {
        const response = await fetch(
          `${API_BASE}/api/traffic-sender/send`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              attack_type: selectedType,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              `第 ${i + 1} 筆發送失敗`
          );
        }

        // Sender 只負責記錄發送進度
        // 不負責判斷 Incident
        setSent(i + 1);

        if (
          i < total - 1 &&
          delay > 0
        ) {
          await sleep(delay);
        }
      }
    } catch (err) {
      console.error(
        "發送失敗：",
        err
      );

      setError(
        err.message ||
          "流量發送失敗"
      );
    } finally {
      setSending(false);
    }
  };

  // ==========================================
  // Progress
  // ==========================================

  const progress =
    Number(count) > 0
      ? Math.min(
          (sent / Number(count)) * 100,
          100
        )
      : 0;

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}

      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-8 py-6">

          <h1 className="text-2xl font-bold">
            AegisAI Traffic Sender
          </h1>

          <p className="text-sm text-slate-400 mt-1">
            IDS 測試流量發送工具
          </p>

        </div>
      </header>

      {/* Main */}

      <main className="max-w-5xl mx-auto p-8">

        <div className="mb-6">

          <h2 className="text-2xl font-bold text-slate-800">
            測試流量發送
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            選擇流量類型並發送至 AegisAI IDS
          </p>

        </div>

        {/* 發送設定 */}

        <div className="bg-white rounded-2xl shadow p-7">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 流量類型 */}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                流量類型
              </label>

              <select
                value={selectedType}
                disabled={
                  sending ||
                  loading
                }
                onChange={(e) =>
                  setSelectedType(
                    e.target.value
                  )
                }
                className="
                  w-full
                  border
                  border-slate-300
                  rounded-xl
                  px-4
                  py-3
                  bg-white
                  outline-none
                  focus:border-blue-500
                  focus:ring-2
                  focus:ring-blue-100
                  disabled:bg-slate-100
                "
              >

                {loading && (
                  <option>
                    載入中...
                  </option>
                )}

                {types.map((type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                ))}

              </select>
            </div>

            {/* 發送數量 */}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                發送數量
              </label>

              <input
                type="number"
                min="1"
                max="1000"
                value={count}
                disabled={sending}
                onChange={(e) =>
                  setCount(
                    e.target.value
                  )
                }
                className="
                  w-full
                  border
                  border-slate-300
                  rounded-xl
                  px-4
                  py-3
                  outline-none
                  focus:border-blue-500
                  focus:ring-2
                  focus:ring-blue-100
                  disabled:bg-slate-100
                "
              />
            </div>

            {/* 發送間隔 */}

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                發送間隔（ms）
              </label>

              <input
                type="number"
                min="0"
                value={interval}
                disabled={sending}
                onChange={(e) =>
                  setIntervalValue(
                    e.target.value
                  )
                }
                className="
                  w-full
                  border
                  border-slate-300
                  rounded-xl
                  px-4
                  py-3
                  outline-none
                  focus:border-blue-500
                  focus:ring-2
                  focus:ring-blue-100
                  disabled:bg-slate-100
                "
              />
            </div>

          </div>

          {/* Button */}

          <button
            onClick={startSending}
            disabled={
              sending ||
              loading ||
              !selectedType
            }
            className="
              mt-7
              px-7
              py-3
              bg-blue-600
              text-white
              font-medium
              rounded-xl
              hover:bg-blue-700
              transition
              disabled:bg-slate-400
              disabled:cursor-not-allowed
            "
          >
            {sending
              ? "發送中..."
              : "▶ 開始發送"}
          </button>

          {/* Error */}

          {error && (
            <div
              className="
                mt-5
                bg-red-50
                border
                border-red-200
                text-red-600
                rounded-xl
                px-4
                py-3
                text-sm
              "
            >
              {error}
            </div>
          )}

        </div>

        {/* 發送進度 */}

        <div className="bg-white rounded-2xl shadow p-7 mt-6">

          <div className="flex justify-between items-center">

            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                發送進度
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                {selectedType ||
                  "尚未選擇流量類型"}
              </p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">

                {sent}

                <span className="text-base font-normal text-slate-400">
                  {" "}
                  / {count}
                </span>

              </p>
            </div>

          </div>

          {/* Progress Bar */}

          <div className="w-full h-3 bg-slate-200 rounded-full mt-6 overflow-hidden">

            <div
              className="
                h-full
                bg-blue-600
                rounded-full
                transition-all
                duration-300
              "
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

          {/* Status */}

          <div className="mt-6 flex items-center justify-between">

            <div className="text-sm text-slate-500">

              發送間隔：

              <span className="font-medium text-slate-700 ml-1">
                {interval} ms
              </span>

            </div>

            <div>

              {sending ? (
                <span className="text-blue-600 font-medium">
                  ● 發送中
                </span>
              ) : sent > 0 &&
                sent ===
                  Number(count) ? (
                <span className="text-green-600 font-medium">
                  ● 發送完成
                </span>
              ) : (
                <span className="text-slate-500 font-medium">
                  ● 等待發送
                </span>
              )}

            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

export default App;