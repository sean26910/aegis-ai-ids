import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function TrafficChart({ data }) {

  // =========================
  // 整理圖表資料
  // 正常流量 = 總流量 - 異常流量
  // =========================
  const chartData = data.map((item) => ({
    ...item,
    normal: Math.max(
      Number(item.total) - Number(item.attack),
      0
    ),
    attack: Number(item.attack)
  }));

  // =========================
  // 取得最新時間區間資料
  // =========================
  const latest =
    chartData.length > 0
      ? chartData[chartData.length - 1]
      : {
          normal: 0,
          attack: 0
        };

  const currentNormal = latest.normal;
  const currentAttack = latest.attack;

  const currentTotal =
    currentNormal + currentAttack;

  const attackRate =
    currentTotal > 0
      ? ((currentAttack / currentTotal) * 100).toFixed(1)
      : "0.0";


  // =========================
  // 自訂 Tooltip
  // =========================
  const CustomTooltip = ({ active, payload, label }) => {

    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const normal =
      payload.find(
        (item) => item.dataKey === "normal"
      )?.value ?? 0;

    const attack =
      payload.find(
        (item) => item.dataKey === "attack"
      )?.value ?? 0;

    const total =
      Number(normal) + Number(attack);

    const rate =
      total > 0
        ? ((Number(attack) / total) * 100).toFixed(1)
        : "0.0";

    return (
      <div className="bg-white border border-slate-200 shadow-lg rounded-xl p-4">

        <p className="font-semibold text-slate-800 mb-3">
          {label}
        </p>

        <div className="space-y-2 text-sm">

          <div className="flex justify-between gap-8">
            <span className="text-slate-500">
              正常流量
            </span>

            <span className="font-semibold text-slate-900">
              {normal} 筆
            </span>
          </div>

          <div className="flex justify-between gap-8">
            <span className="text-slate-500">
              異常流量
            </span>

            <span className="font-semibold text-red-500">
              {attack} 筆
            </span>
          </div>

          <div className="border-t border-slate-100 pt-2 flex justify-between gap-8">
            <span className="text-slate-500">
              異常比例
            </span>

            <span className="font-semibold text-red-500">
              {rate}%
            </span>
          </div>

        </div>

      </div>
    );
  };


  return (
    <div className="bg-white rounded-2xl shadow p-6 h-[420px]">

      {/* =========================
          標題
      ========================= */}
      <div className="flex justify-between items-start mb-2">

        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            即時流量趨勢
          </h3>

          <p className="text-sm text-slate-400 mt-1">
            最近 30 分鐘網路流量
          </p>
        </div>

        {/* 即時監控狀態 */}
        {/* <div className="flex items-center gap-2 text-sm text-slate-500">

          <span className="relative flex h-2.5 w-2.5">

            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />

            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />

          </span>

          即時監控中

        </div> */}

      </div>


      {/* =========================
          圖表
      ========================= */}
      <div className="h-[245px]">

        <ResponsiveContainer width="100%" height="100%">

          <ComposedChart
            data={chartData}
            margin={{
              top: 15,
              right: 10,
              left: -10,
              bottom: 0
            }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />

            <XAxis
              dataKey="time"
              tick={{
                fontSize: 12,
                fill: "#64748B"
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              allowDecimals={false}
              tick={{
                fontSize: 12,
                fill: "#64748B"
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              content={<CustomTooltip />}
            />

            {/* 異常流量區域 */}
            <Area
              type="monotone"
              dataKey="attack"
              stroke="#EF4444"
              fill="#FEE2E2"
              strokeWidth={2}
              fillOpacity={0.7}
              name="異常流量"
            />

            {/* 正常流量折線 */}
            <Line
              type="monotone"
              dataKey="normal"
              stroke="#0F172A"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5
              }}
              name="正常流量"
            />

          </ComposedChart>

        </ResponsiveContainer>

      </div>


      {/* =========================
          當前流量
      ========================= */}
      <div className="border-t border-slate-100 mt-2 pt-4">

        <div className="grid grid-cols-3">

          {/* 當前正常流量 */}
          <div className="flex items-center justify-center gap-3">

            <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />

            <div>
              <p className="text-xs text-slate-400">
                當前正常流量
              </p>

              <p className="text-lg font-bold text-slate-900">
                {currentNormal}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  筆
                </span>
              </p>
            </div>

          </div>


          {/* 當前異常流量 */}
          <div className="flex items-center justify-center gap-3 border-l border-slate-100">

            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />

            <div>
              <p className="text-xs text-slate-400">
                當前異常流量
              </p>

              <p className="text-lg font-bold text-red-500">
                {currentAttack}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  筆
                </span>
              </p>
            </div>

          </div>


          {/* 異常比例 */}
          <div className="flex items-center justify-center border-l border-slate-100">

            <div>
              <p className="text-xs text-slate-400">
                當前異常比例
              </p>

              <p className="text-lg font-bold text-red-500">
                {attackRate}%
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

export default TrafficChart;