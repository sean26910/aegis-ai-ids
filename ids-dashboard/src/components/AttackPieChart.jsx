import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const COLORS = [
  "#EF4444",
  "#F59E0B",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B"
];

function AttackPieChart({ attackStats }) {

  const data = Object.entries(attackStats).map(
    ([name, value]) => ({
      name,
      value
    })
  );

  const total = data.reduce(
    (sum, item) => sum + item.value,
    0
  );

  return (
    <div className="bg-white rounded-2xl shadow p-6 h-[350px]">

      <h3 className="text-lg font-semibold mb-4">
        攻擊類型分布
      </h3>

      {data.length === 0 ? (

        <div className="h-[250px] flex items-center justify-center">
          <p className="text-slate-400">
            目前尚未偵測到異常流量
          </p>
        </div>

      ) : (

        <div className="flex h-[250px] items-center gap-4">

          {/* =========================
              圓餅圖
          ========================= */}

          <div className="w-1/2 h-full">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <PieChart>

                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >

                  {data.map((item, index) => (

                    <Cell
                      key={item.name}
                      fill={
                        COLORS[
                          index % COLORS.length
                        ]
                      }
                    />

                  ))}

                </Pie>

                <Tooltip
                  formatter={(value, name) => [
                    `${value} 筆`,
                    name
                  ]}
                />

              </PieChart>

            </ResponsiveContainer>

          </div>


          {/* =========================
              攻擊類型列表
          ========================= */}

          <div
            className="
              w-1/2
              max-h-[230px]
              overflow-y-auto
              pr-3
            "
          >

            <div className="space-y-3">

              {data.map((item, index) => {

                const percentage =
                  total > 0
                    ? (
                        (item.value / total) *
                        100
                      ).toFixed(1)
                    : 0;

                return (

                  <div
                    key={item.name}
                    className="
                      flex
                      items-center
                      justify-between
                      gap-3
                    "
                  >

                    {/* 左邊 */}

                    <div className="
                      flex
                      items-center
                      gap-3
                      min-w-0
                    ">

                      {/* 顏色 */}

                      <span
                        className="
                          w-3
                          h-3
                          rounded-full
                          shrink-0
                        "
                        style={{
                          backgroundColor:
                            COLORS[
                              index %
                              COLORS.length
                            ]
                        }}
                      />

                      {/* 名稱 */}

                      <div className="min-w-0">

                        <p className="
                          text-sm
                          font-medium
                          text-slate-700
                          leading-tight
                          break-words
                        ">
                          {item.name}
                        </p>

                        <p className="
                          text-xs
                          text-slate-400
                          mt-1
                        ">
                          {item.value} 筆
                        </p>

                      </div>

                    </div>


                    {/* 百分比 */}

                    <span className="
                      text-sm
                      font-semibold
                      text-slate-700
                      shrink-0
                    ">
                      {percentage}%
                    </span>

                  </div>

                );

              })}

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default AttackPieChart;