import { useState } from "react";

function AttackHistory({ alerts }) {
  const [searchIp, setSearchIp] = useState("");
  const [attackType, setAttackType] = useState("ALL");

  // 取得目前存在的攻擊類型
  const attackTypes = [
    ...new Set(
      alerts
        .map((alert) => alert.prediction)
        .filter(Boolean)
    ),
  ];

  // 搜尋 + 篩選
  const filteredAlerts = alerts.filter((alert) => {
    const matchIp =
      !searchIp ||
      (alert.src_ip || "")
        .toLowerCase()
        .includes(searchIp.toLowerCase());

    const matchType =
      attackType === "ALL" ||
      alert.prediction === attackType;

    return matchIp && matchType;
  });

  return (
    <div className="bg-white rounded-2xl shadow p-6">

      {/* 標題 */}
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-slate-800">
          異常事件查詢
        </h3>

        <p className="text-sm text-slate-500 mt-1">
          搜尋與篩選系統偵測到的異常流量
        </p>
      </div>

      {/* 搜尋區 */}
      <div className="flex gap-4 mb-6">

        {/* IP 搜尋 */}
        <input
          type="text"
          placeholder="搜尋來源 IP"
          value={searchIp}
          onChange={(e) => setSearchIp(e.target.value)}
          className="
            flex-1
            border border-slate-300
            rounded-lg
            px-4 py-2
            outline-none
            focus:ring-2
            focus:ring-blue-500
          "
        />

        {/* 攻擊類型 */}
        <select
          value={attackType}
          onChange={(e) => setAttackType(e.target.value)}
          className="
            border border-slate-300
            rounded-lg
            px-4 py-2
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
            <option key={type} value={type}>
              {type}
            </option>
          ))}

        </select>

      </div>

      {/* 搜尋結果數量 */}
      <div className="mb-4 text-sm text-slate-500">
        共找到 {filteredAlerts.length} 筆異常事件
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">

        <table className="w-full">

          <thead>
            <tr className="border-b text-left text-slate-500">

              <th className="py-3">
                偵測時間
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

            {filteredAlerts.map((alert, index) => (
              <tr
                key={alert.id || index}
                className="
                  border-b
                  last:border-none
                  hover:bg-slate-50
                  transition
                "
              >

                <td className="py-4">
                  {alert.captured_at || "-"}
                </td>

                <td>
                  {alert.src_ip || "-"}
                </td>

                <td>
                  {alert.dst_port ?? "-"}
                </td>

                <td>
                  <span className="text-red-500 font-medium">
                    {alert.prediction}
                  </span>
                </td>

              </tr>
            ))}

          </tbody>

        </table>

        {/* 沒有結果 */}
        {filteredAlerts.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            找不到符合條件的異常事件
          </div>
        )}

      </div>

    </div>
  );
}

export default AttackHistory;