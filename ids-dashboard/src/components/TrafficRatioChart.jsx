import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from "recharts";

function TrafficRatioChart({ benign, attack }) {
  const normal = Number(benign) || 0;
  const abnormal = Number(attack) || 0;
  const total = normal + abnormal;

  const data = [
    {
      name: "正常流量",
      value: normal
    },
    {
      name: "異常流量",
      value: abnormal
    }
  ];

  const COLORS = [
    "#0F172A", // 正常：黑色
    "#EF4444"  // 異常：紅色
  ];

  if (total === 0) {
    return (
      <div className="h-[220px] flex items-center justify-center text-slate-400">
        目前尚無流量資料
      </div>
    );
  }

  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>

          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={COLORS[index]}
              />
            ))}
          </Pie>

          <Tooltip />

        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TrafficRatioChart;