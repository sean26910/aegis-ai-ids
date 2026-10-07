import { useEffect, useState } from "react";
import {
  Play,
  RefreshCw,
  Activity,
  Target,
  ShieldCheck,
  CircleCheck,
  CircleX,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:5000";

function ModelTest() {
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [count, setCount] = useState(10);

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [testing, setTesting] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // =========================
  // 取得資料集所有 Label
  // =========================

  useEffect(() => {
    const loadTypes = async () => {
      setLoadingTypes(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/model-test/types`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "取得測試資料類型失敗"
          );
        }

        const labels = Array.isArray(data.types)
          ? data.types
          : [];

        setTypes(labels);

        if (labels.length > 0) {
          setSelectedType(labels[0]);
        }
      } catch (err) {
        console.error(
          "取得模型測試類型失敗：",
          err
        );

        setError(
          err.message || "無法取得測試資料類型"
        );
      } finally {
        setLoadingTypes(false);
      }
    };

    loadTypes();
  }, []);

  // =========================
  // 開始批次模型測試
  // =========================

  const startTest = async () => {
    if (!selectedType) {
      setError("請先選擇流量類型");
      return;
    }

    const testCount = Number(count);

    if (
      !Number.isInteger(testCount) ||
      testCount < 1
    ) {
      setError("發送數量必須大於 0");
      return;
    }

    setTesting(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/model-test/batch`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            attack_type: selectedType,
            count: testCount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "模型測試失敗"
        );
      }

      setResult(data);
    } catch (err) {
      console.error("模型測試失敗：", err);

      setError(
        err.message || "模型測試失敗"
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      {/* =========================
          標題
      ========================= */}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">
          IDS 模型偵測測試
        </h2>

        <p className="text-sm text-slate-500 mt-1">
          選擇測試資料類型，批次發送至階層式入侵偵測模型
        </p>
      </div>

      {/* =========================
          測試設定
      ========================= */}

      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="font-semibold text-slate-800 mb-5">
          測試設定
        </h3>

        <div className="grid grid-cols-2 gap-6">
          {/* 流量類型 */}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              流量類型
            </label>

            <select
              value={selectedType}
              onChange={(e) =>
                setSelectedType(e.target.value)
              }
              disabled={
                loadingTypes || testing
              }
              className="
                w-full
                border
                border-slate-200
                rounded-xl
                px-4
                py-3
                bg-white
                outline-none
                focus:border-blue-400
                focus:ring-2
                focus:ring-blue-100
                disabled:bg-slate-100
              "
            >
              {loadingTypes && (
                <option>
                  載入資料中...
                </option>
              )}

              {!loadingTypes &&
                types.length === 0 && (
                  <option>
                    無可用資料
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
              disabled={testing}
              onChange={(e) =>
                setCount(e.target.value)
              }
              className="
                w-full
                border
                border-slate-200
                rounded-xl
                px-4
                py-3
                outline-none
                focus:border-blue-400
                focus:ring-2
                focus:ring-blue-100
                disabled:bg-slate-100
              "
            />
          </div>
        </div>

        {/* 發送按鈕 */}

        <button
          onClick={startTest}
          disabled={
            testing ||
            loadingTypes ||
            !selectedType
          }
          className="
            mt-6
            flex
            items-center
            gap-2
            px-6
            py-3
            bg-blue-600
            text-white
            rounded-xl
            hover:bg-blue-700
            disabled:bg-slate-300
            disabled:cursor-not-allowed
          "
        >
          {testing ? (
            <RefreshCw
              size={18}
              className="animate-spin"
            />
          ) : (
            <Play size={18} />
          )}

          {testing
            ? "模型偵測中..."
            : "開始發送"}
        </button>

        {/* 錯誤 */}

        {error && (
          <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* =========================
          尚未測試
      ========================= */}

      {!result && !testing && (
        <div className="bg-white rounded-2xl shadow p-12 mt-6 text-center">
          <Activity
            size={36}
            className="text-blue-500 mx-auto"
          />

          <h3 className="font-semibold text-slate-800 mt-4">
            等待模型測試
          </h3>

          <p className="text-sm text-slate-500 mt-2">
            選擇流量類型與發送數量後，按下開始發送。
          </p>
        </div>
      )}

      {/* =========================
          Loading
      ========================= */}

      {testing && (
        <div className="bg-white rounded-2xl shadow p-12 mt-6 text-center">
          <RefreshCw
            size={36}
            className="text-blue-500 animate-spin mx-auto"
          />

          <h3 className="font-semibold text-slate-800 mt-4">
            IDS 模型偵測中
          </h3>

          <p className="text-sm text-slate-500 mt-2">
            正在將 {count} 筆 {selectedType} 資料送入模型...
          </p>
        </div>
      )}

      {/* =========================
          測試結果
      ========================= */}

      {result && !testing && (
        <>
          {/* 三張統計卡 */}

          <div className="grid grid-cols-3 gap-6 mt-6">
            {/* 測試類型 */}

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">
                  測試資料
                </p>

                <Activity
                  size={24}
                  className="text-blue-500"
                />
              </div>

              <p
                className="text-2xl font-bold text-slate-900 mt-3 truncate"
                title={result.attack_type}
              >
                {result.attack_type}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                選擇的資料類型
              </p>
            </div>

            {/* 數量 */}

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">
                  已偵測數量
                </p>

                <Target
                  size={24}
                  className="text-slate-700"
                />
              </div>

              <p className="text-3xl font-bold text-slate-900 mt-3">
                {result.tested_count}
              </p>

              <p className="text-xs text-slate-400 mt-2">
                筆測試流量
              </p>
            </div>

            {/* 正確率 */}

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">
                  偵測正確率
                </p>

                <ShieldCheck
                  size={24}
                  className="text-slate-900"
                />
              </div>

              <p className="text-3xl font-bold text-slate-900 mt-3">
                {Number(result.accuracy).toFixed(1)}%
              </p>

              <p className="text-xs text-slate-400 mt-2">
                {result.correct_count} /{" "}
                {result.tested_count} 筆正確
              </p>
            </div>
          </div>

          {/* =========================
              預測分布
          ========================= */}

          <div className="bg-white rounded-2xl shadow p-6 mt-6">
            <h3 className="font-semibold text-slate-800">
              模型預測分布
            </h3>

            <p className="text-sm text-slate-500 mt-1 mb-5">
              批次資料經模型偵測後的分類結果
            </p>

            {Object.keys(
              result.prediction_counts || {}
            ).length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                無預測結果
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(
                  result.prediction_counts
                )
                  .sort(
                    (a, b) =>
                      Number(b[1]) -
                      Number(a[1])
                  )
                  .map(
                    ([prediction, value]) => (
                      <div
                        key={prediction}
                        className="
                          border
                          border-slate-200
                          rounded-xl
                          p-4
                          bg-slate-50
                        "
                      >
                        <p
                          className="text-sm text-slate-500 truncate"
                          title={prediction}
                        >
                          {prediction}
                        </p>

                        <p className="text-2xl font-bold text-slate-800 mt-2">
                          {value}

                          <span className="text-sm font-normal text-slate-400 ml-1">
                            筆
                          </span>
                        </p>
                      </div>
                    )
                  )}
              </div>
            )}
          </div>

          {/* =========================
              詳細結果
          ========================= */}

          <div className="bg-white rounded-2xl shadow p-6 mt-6">
            <h3 className="font-semibold text-slate-800">
              詳細偵測結果
            </h3>

            <p className="text-sm text-slate-500 mt-1 mb-5">
              顯示每一筆測試資料的模型預測結果
            </p>

            <div className="max-h-[450px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-3 px-2">
                      #
                    </th>

                    <th className="px-2">
                      輸入資料
                    </th>

                    <th className="px-2">
                      模型預測
                    </th>

                    <th className="px-2">
                      結果
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(result.results || []).map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100"
                      >
                        <td className="py-3 px-2 text-slate-400">
                          {item.id}
                        </td>

                        <td className="px-2 font-medium text-slate-700">
                          {result.attack_type}
                        </td>

                        <td className="px-2 font-medium text-slate-800">
                          {item.prediction}
                        </td>

                        <td className="px-2">
                          {item.correct ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CircleCheck
                                size={16}
                              />
                              正確
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500">
                              <CircleX
                                size={16}
                              />
                              錯誤
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ModelTest;