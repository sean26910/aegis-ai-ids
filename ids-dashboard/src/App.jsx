import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  Activity,
  ShieldCheck,
  ShieldAlert,
  LayoutDashboard,
  ChartNoAxesCombined,
  TriangleAlert,
  Sparkles,
  FileText
} from "lucide-react";
import aegisLogo from "./assets/logo.png";
import AlertsPage from "./pages/AlertsPage";
import TrafficRatioChart from "./components/TrafficRatioChart";
import TrafficChart from "./components/TrafficChart";
import AttackPieChart from "./components/AttackPieChart";
import FlowTable from "./components/FlowTable";
import AlertCenter from "./components/AlertCenter";
import AIAnalysis from "./pages/AIAnalysis";


function App() {

  // =========================
  // State
  // =========================

  const [stats, setStats] = useState({
    total: 0,
    benign: 0,
    attack: 0,
  });

  const [flows, setFlows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [attackStats, setAttackStats] = useState({});
  const [trafficData, setTrafficData] = useState([]);

  const [page, setPage] = useState("dashboard");


  // =========================
  // 初始化
  // =========================

  useEffect(() => {

    const socket = io("http://127.0.0.1:5000");


    // =========================
    // Dashboard 統計
    // =========================

    fetch("http://127.0.0.1:5000/api/dashboard")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
      })
      .catch((error) => {
        console.error("取得 Dashboard 統計失敗：", error);
      });


    // =========================
    // 最近 Flow
    // =========================

    fetch("http://127.0.0.1:5000/api/recent-flows")
      .then((res) => res.json())
      .then((data) => {
        setFlows(data);
      })
      .catch((error) => {
        console.error("取得最近 Flow 失敗：", error);
      });


    // =========================
    // 攻擊類型統計
    // =========================

    fetch("http://127.0.0.1:5000/api/attack-stats")
      .then((res) => res.json())
      .then((data) => {

        const result = {};

        data.forEach((item) => {
          result[item.prediction] = Number(item.total);
        });

        setAttackStats(result);

      })
      .catch((error) => {
        console.error("取得攻擊統計失敗：", error);
      });


    // =========================
    // 最近異常事件
    // =========================

    fetch("http://127.0.0.1:5000/api/recent-alerts")
      .then((res) => res.json())
      .then((data) => {
        setAlerts(data);
      })
      .catch((error) => {
        console.error("取得最近異常事件失敗：", error);
      });


    // =========================
    // 取得最近 30 分鐘流量
    // =========================

    const fetchTrafficStats = () => {
      fetch("http://127.0.0.1:5000/api/traffic-stats")
        .then((res) => res.json())
        .then((data) => {

          console.log("API 原始資料：", data);

          const formatted = data.map((item) => ({
            time: item.bucket_time.slice(11, 16),
            total: Number(item.total),
            attack: Number(item.attack),
          }));

          console.log("圖表資料：", formatted);

          setTrafficData(formatted);
        })
        .catch((error) => {
          console.error("取得流量趨勢失敗：", error);
        });
    };


    // 第一次進入頁面立即取得
    fetchTrafficStats();


    // =========================
    // 每 60 秒更新流量趨勢
    // =========================

    const trafficInterval = setInterval(() => {
      console.log("自動更新最近 30 分鐘流量");
      fetchTrafficStats();

    }, 60000);


    // =========================
    // Socket 連線成功
    // =========================

    socket.on("connect", () => {

      console.log(
        "Socket 連線成功：",
        socket.id
      );

    });


    // =========================
    // Socket 連線失敗
    // =========================

    socket.on("connect_error", (error) => {

      console.error(
        "Socket 連線失敗：",
        error
      );

    });


    // =========================
    // 收到新的 Flow
    // =========================

    socket.on("new_flow", (data) => {

      const flow = data.flow;

      console.log(
        "收到新 Flow：",
        flow
      );


      // =========================
      // 1. 更新 Dashboard 統計
      // =========================

      setStats(data.stats);


      // =========================
      // 2. 更新最近 Flow
      // =========================

      setFlows((prev) =>
        [flow, ...prev].slice(0, 30)
      );


      // =========================
      // 3. 如果是異常流量
      // =========================

      if (flow.prediction !== "BENIGN") {

        // 更新最近異常事件

        setAlerts((prev) =>
          [flow, ...prev].slice(0, 30)
        );


        // 重新取得攻擊類型統計

        fetch("http://127.0.0.1:5000/api/attack-stats")
          .then((res) => res.json())
          .then((attackData) => {

            const result = {};

            attackData.forEach((item) => {
              result[item.prediction] =
                Number(item.total);
            });

            setAttackStats(result);

          })
          .catch((error) => {

            console.error(
              "更新攻擊統計失敗：",
              error
            );

          });

      }


      // =========================
      // 4. 有新 Flow 時
      //    立即更新流量趨勢
      // =========================

      fetchTrafficStats();

    }); // ← 你原本就是少了這個


    // =========================
    // Cleanup
    // =========================

    return () => {

      // 清除 60 秒 Timer
      clearInterval(trafficInterval);

      // 清除 Socket event
      socket.off("connect");
      socket.off("connect_error");
      socket.off("new_flow");

      // 中斷 Socket
      socket.disconnect();

    };

  }, []);


  // =========================
  // UI
  // =========================

  return (

    <div className="flex min-h-screen bg-slate-100">


      {/* =========================
          Sidebar
      ========================= */}

      <aside className="fixed top-0 left-0 w-64 h-screen bg-slate-900 text-white p-5 overflow-y-auto z-50">


        <div className="mb-10">
          <img
            src={aegisLogo}
            alt="AegisAI"
            className="w-full h-auto object-contain"
          />
        </div>


        <nav className="space-y-6">

          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              監控
            </p>

            <div className="space-y-1">
              <button
                onClick={() => setPage("dashboard")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  page === "dashboard"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <LayoutDashboard size={18} />
                <span>系統總覽</span>
              </button>

              <button
                onClick={() => setPage("statistics")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  page === "statistics"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <ChartNoAxesCombined size={18} />
                <span>流量統計</span>
              </button>

              <button
                onClick={() => setPage("alerts")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  page === "alerts"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <TriangleAlert size={18} />
                <span>異常事件</span>
              </button>
            </div>
          </div>

          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              智慧分析
            </p>

            <div className="space-y-1">
              <button
                onClick={() => setPage("ai-analysis")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  page === "ai-analysis"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Sparkles size={18} />
                <span>AI 安全分析</span>
              </button>
              
            </div>
          </div>

          <div>
            <p className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              報告
            </p>

            <div className="space-y-1">
              <button
                onClick={() => setPage("report")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  page === "report"
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <FileText size={18} />
                <span>安全報表</span>
              </button>
            </div>
          </div>

        </nav>


      </aside>


      {/* =========================
          Main
      ========================= */}

      <main className="flex-1 ml-64">


        <div className="p-6">


          {/* =========================
              平台標題
          ========================= */}

          <div className="mb-8">

            <h1 className="text-4xl font-bold text-blue-600">

              自動化攻擊分析平台

            </h1>

          </div>


          {/* =========================
              系統總覽
          ========================= */}

          {page === "dashboard" && (

            <>


              <div className="mb-6">

                <h2 className="text-xl font-bold text-slate-800">

                  系統總覽

                </h2>


                <p className="text-sm text-slate-500 mt-1">

                  即時網路流量與入侵偵測狀態

                </p>

              </div>


              {/* =========================
                  圖表
              ========================= */}

              <div className="grid grid-cols-2 gap-6">


                <TrafficChart
                  data={trafficData}
                />


                <AttackPieChart
                  attackStats={attackStats}
                />


              </div>


              {/* =========================
                  最近分析結果
              ========================= */}

              <FlowTable flows={flows} />


              {/* =========================
                  最新異常事件
              ========================= */}

              <AlertCenter
                alerts={alerts}
              />


            </>

          )}


          {/* =========================
              流量統計
          ========================= */}

          {page === "statistics" && (

            <>


              <div className="mb-6">


                <h2 className="text-xl font-bold text-slate-800">

                  流量統計

                </h2>


                <p className="text-sm text-slate-500 mt-1">

                  查看系統目前累積之流量與攻擊統計資訊

                </p>


              </div>


              {/* =========================
                  三張統計卡
              ========================= */}

              <div className="grid grid-cols-3 gap-6">


                {/* 總流量 */}

                <div className="bg-white rounded-2xl shadow p-6">


                  <div className="flex justify-between items-center">


                    <p className="text-sm text-slate-500">

                      總流量

                    </p>


                    <Activity
                      size={26}
                      className="text-blue-500"
                    />


                  </div>


                  <p className="text-4xl font-bold mt-3 text-slate-800">

                    {stats.total}

                  </p>


                </div>


                {/* 正常流量 */}

                <div className="bg-white rounded-2xl shadow p-6">


                  <div className="flex justify-between items-center">


                    <p className="text-sm text-slate-500">

                      正常流量

                    </p>


                    <ShieldCheck
                      size={26}
                      className="text-slate-900"
                    />


                  </div>


                  <p className="text-4xl font-bold mt-3 text-slate-900">

                    {stats.benign}

                  </p>


                </div>


                {/* 異常流量 */}

                <div className="bg-white rounded-2xl shadow p-6">


                  <div className="flex justify-between items-center">


                    <p className="text-sm text-slate-500">

                      異常流量

                    </p>


                    <ShieldAlert
                      size={26}
                      className="text-red-500"
                    />


                  </div>


                  <p className="text-4xl font-bold mt-3 text-red-500">

                    {stats.attack}

                  </p>


                </div>


              </div>


              {/* =========================
                  正常 / 異常比例
              ========================= */}

              <div className="bg-white rounded-2xl shadow p-6 mt-8">


                <h3 className="text-lg font-semibold text-slate-800 mb-4">

                  流量比例

                </h3>


                <div className="grid grid-cols-2 gap-8 items-center">


                  {/* 左側圓餅圖 */}

                  <TrafficRatioChart
                    benign={stats.benign}
                    attack={stats.attack}
                  />


                  {/* 右側比例 */}

                  <div className="space-y-8">


                    {/* 正常流量 */}

                    <div>


                      <p className="text-sm text-slate-500">

                        正常流量比例

                      </p>


                      <p className="text-3xl font-bold text-slate-900 mt-2">

                        {
                          stats.total > 0
                            ? (
                                (
                                  Number(stats.benign) /
                                  Number(stats.total)
                                ) * 100
                              ).toFixed(1)
                            : 0
                        }

                        %

                      </p>


                    </div>


                    {/* 異常流量 */}

                    <div>


                      <p className="text-sm text-slate-500">

                        異常流量比例

                      </p>


                      <p className="text-3xl font-bold text-red-500 mt-2">

                        {
                          stats.total > 0
                            ? (
                                (
                                  Number(stats.attack) /
                                  Number(stats.total)
                                ) * 100
                              ).toFixed(1)
                            : 0
                        }

                        %

                      </p>


                    </div>


                  </div>


                </div>


              </div>


              {/* =========================
                  各攻擊類型數量統計
              ========================= */}

              <div className="mt-8 bg-white rounded-2xl shadow p-6">


                <div className="mb-6">


                  <h3 className="text-lg font-semibold text-slate-800">

                    各攻擊類型數量統計

                  </h3>


                  <p className="text-sm text-slate-500 mt-1">

                    依目前資料庫中所有異常流量進行統計

                  </p>


                </div>


                {/* 沒有攻擊資料 */}

                {
                  Object.keys(attackStats).length === 0
                    ? (

                      <div className="py-10 text-center text-slate-400">

                        目前尚未偵測到異常流量

                      </div>

                    )
                    : (

                      <div className="grid grid-cols-3 gap-4">


                        {
                          Object.entries(attackStats)

                            .sort(
                              (a, b) =>
                                Number(b[1]) -
                                Number(a[1])
                            )

                            .map(
                              ([attackName, count]) => (

                                <div

                                  key={attackName}

                                  className="
                                    border
                                    border-slate-200
                                    rounded-xl
                                    p-5
                                    bg-slate-50
                                  "
                                >


                                  <p className="text-sm text-slate-500">

                                    {attackName}

                                  </p>


                                  <p className="text-2xl font-bold text-slate-800 mt-2">

                                    {Number(count)}

                                    <span className="text-sm font-normal text-slate-500 ml-1">

                                      筆

                                    </span>

                                  </p>


                                </div>

                              )
                            )
                        }


                      </div>

                    )
                }


              </div>


            </>

          )}

          {page === "alerts" && <AlertsPage />}

          {page === "ai-analysis" && <AIAnalysis />}
          {page === "report" && (
            <div>
              <h2 className="text-xl font-bold text-slate-800">安全報表</h2>
              <p className="text-sm text-slate-500 mt-1">查看與產生網路安全分析報告</p>
              <div className="bg-white rounded-2xl shadow p-8 mt-6 text-slate-400">
                安全報表功能建置中
              </div>
            </div>
          )}


        </div>


      </main>


    </div>

  );

}


export default App;