import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:5000";

function FlowTable({ flows = [] }) {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // =========================
  // 第一次載入完整攻擊紀錄
  // =========================

  useEffect(() => {
    const fetchAttackHistory = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/attack-history`
        );

        if (!response.ok) {
          throw new Error("取得攻擊紀錄失敗");
        }

        const data = await response.json();

        setHistory(
          Array.isArray(data) ? data : []
        );

        setError("");

      } catch (err) {
        console.error(
          "取得攻擊紀錄失敗：",
          err
        );

        setError("無法取得攻擊紀錄");

      } finally {
        setLoading(false);
      }
    };

    fetchAttackHistory();
  }, []);

  // =========================
  // App.jsx 收到 Socket.IO
  // flows 更新時
  // 將最新攻擊加入歷史紀錄
  // =========================

  useEffect(() => {
    if (flows.length === 0) {
      return;
    }

    const newestFlow = flows[0];

    if (
      !newestFlow ||
      newestFlow.prediction === "BENIGN"
    ) {
      return;
    }

    setHistory((prev) => {
      // -------------------------
      // 防止同一筆重複加入
      // -------------------------

      if (newestFlow.id) {
        const exists = prev.some(
          (item) =>
            item.id === newestFlow.id
        );

        if (exists) {
          return prev;
        }
      }

      // 最新資料放最上面
      return [
        newestFlow,
        ...prev,
      ];
    });

  }, [flows]);

  // =========================
  // 所有曾經出現過的攻擊類型
  // =========================

  const attackTypes = [
    ...new Set(
      history
        .map((flow) => flow.prediction)
        .filter(
          (prediction) =>
            prediction &&
            prediction !== "BENIGN"
        )
    ),
  ].sort();

  // =========================
  // Filter
  // =========================

  const filteredFlows =
    filter === "ALL"
      ? history
      : history.filter(
          (flow) =>
            flow.prediction === filter
        );

  return (
    <div className="bg-white rounded-2xl shadow p-6 mt-8">

      {/* 標題 */}

      <div className="flex justify-between items-center mb-6">

        <div>
          <h2 className="text-xl font-bold text-slate-800">
            攻擊紀錄
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            系統偵測到的歷史異常流量
          </p>
        </div>

        {/* Filter */}

        <select
          value={filter}
          onChange={(e) =>
            setFilter(e.target.value)
          }
          className="
            min-w-[180px]
            border
            border-slate-300
            rounded-lg
            px-4
            py-2
            text-sm
            bg-white
            outline-none
            focus:ring-2
            focus:ring-blue-500
          "
        >

          <option value="ALL">
            全部攻擊
          </option>

          {attackTypes.map((type) => (
            <option
              key={type}
              value={type}
            >
              {type}
            </option>
          ))}

        </select>

      </div>

      {/* Loading */}

      {loading && (
        <div className="text-center text-slate-400 py-10">
          載入攻擊紀錄中...
        </div>
      )}

      {/* Error */}

      {!loading && error && (
        <div className="
          bg-red-50
          border
          border-red-200
          text-red-600
          rounded-lg
          px-4
          py-3
        ">
          {error}
        </div>
      )}

      {/* Table */}

      {!loading && !error && (
        <>

          <div className="mb-4 text-sm text-slate-500">
            共{" "}
            <span className="font-semibold text-slate-700">
              {filteredFlows.length}
            </span>{" "}
            筆攻擊紀錄
          </div>

          <div className="
            overflow-x-auto
            max-h-[500px]
            overflow-y-auto
          ">

            <table className="w-full">

              <thead className="
                sticky
                top-0
                bg-white
                z-10
              ">

                <tr className="
                  border-b
                  text-left
                  text-slate-500
                ">

                  <th className="py-3">
                    時間
                  </th>

                  <th>
                    來源 IP
                  </th>

                  <th>
                    目的埠
                  </th>

                  <th>
                    攻擊類型
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredFlows.map(
                  (flow, index) => (

                    <tr
                      key={
                        flow.id ||
                        `${flow.captured_at}-${index}`
                      }
                      className="
                        border-b
                        last:border-none
                        hover:bg-slate-50
                        transition
                      "
                    >

                      <td className="py-4">
                        {flow.captured_at || "-"}
                      </td>

                      <td>
                        {flow.src_ip || "-"}
                      </td>

                      <td>
                        {flow.dst_port ?? "-"}
                      </td>

                      <td>
                        <span className="
                          text-red-500
                          font-medium
                        ">
                          {flow.prediction || "-"}
                        </span>
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

            {filteredFlows.length === 0 && (
              <div className="
                text-center
                text-slate-400
                py-10
              ">
                目前沒有符合條件的攻擊紀錄
              </div>
            )}

          </div>

        </>
      )}

    </div>
  );
}

export default FlowTable;