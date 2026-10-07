import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  Send,
  RefreshCw,
  Clock3,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:5000";

function formatTime(value) {
  if (!value) return "--:--";

  const text = String(value);

  // 後端目前回傳 YYYY/MM/DD HH:mm:ss，直接取時間最穩定
  const match = text.match(/(\d{2}):(\d{2})(?::\d{2})?/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  return text;
}

function AIAnalysis() {
  const [stats, setStats] = useState({
    total: 0,
    benign: 0,
    attack: 0,
  });

  const [attackStats, setAttackStats] = useState({});
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [aiConnected, setAiConnected] = useState(false);
  const [error, setError] = useState("");

  // 使用 /api/ai-analysis 取得與 LLM 完全相同的最近 30 分鐘 Security Context
  // 進入頁面 / 按「更新資料」時，只取得最近 30 分鐘 Security Context。
  // 不呼叫 LLM，因此不會產生 AI API 使用量。
  const loadSecurityData = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/ai-context`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "取得安全資料失敗");
      }

      updateFromSecurityContext(data.security_context);
    } catch (err) {
      console.error("取得 AI 安全分析資料失敗：", err);
      setError(err.message || "無法取得安全分析資料");
    } finally {
      setLoading(false);
    }
  };

  const updateFromSecurityContext = (context) => {
    if (!context) return;

    const traffic = context.traffic || {};

    setStats({
      total: Number(traffic.total) || 0,
      benign: Number(traffic.benign) || 0,
      attack: Number(traffic.attack) || 0,
    });

    setAttackStats(context.attack_distribution || {});
    setAlerts(
      Array.isArray(context.recent_alerts) ? context.recent_alerts : []
    );
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  const attackRate =
    stats.total > 0
      ? ((stats.attack / stats.total) * 100).toFixed(1)
      : "0.0";

  const topAttack = useMemo(() => {
    const entries = Object.entries(attackStats);

    if (entries.length === 0) {
      return "尚無異常";
    }

    entries.sort((a, b) => Number(b[1]) - Number(a[1]));

    return entries[0][0];
  }, [attackStats]);

  const suggestedQuestions = [
    "最近發生什麼？",
    "哪種攻擊最多？",
    "解釋主要威脅",
    "提供處置建議",
  ];

  const askAI = async (customQuestion) => {
    const finalQuestion =
      typeof customQuestion === "string"
        ? customQuestion.trim()
        : question.trim();

    if (!finalQuestion) {
      return;
    }

    setAiLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/ai-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: finalQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI 分析失敗");
      }

      updateFromSecurityContext(data.security_context);

      setAnalysis(data.analysis || "AI 未回傳分析內容");
      setAiConnected(Boolean(data.ai_connected));
    } catch (err) {
      console.error("AI 分析失敗：", err);
      setError(err.message || "AI 分析失敗");
      setAiConnected(false);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = () => {
    askAI(question);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (!aiLoading && question.trim()) {
        handleSubmit();
      }
    }
  };

  const handleSuggestedQuestion = (item) => {
    setQuestion(item);
    askAI(item);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            AI 安全分析
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            結合 IDS 偵測結果與大型語言模型進行網路威脅分析
          </p>
        </div>

        <button
          onClick={loadSecurityData}
          disabled={loading || aiLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          更新資料
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              異常流量
            </p>

            <ShieldAlert
              size={24}
              className="text-red-500"
            />
          </div>

          <p className="text-3xl font-bold text-red-500 mt-3">
            {stats.attack}
          </p>

          <p className="text-xs text-slate-400 mt-2">
            最近 30 分鐘 IDS 偵測結果
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              異常比例
            </p>

            <Activity
              size={24}
              className="text-slate-700"
            />
          </div>

          <p className="text-3xl font-bold text-slate-900 mt-3">
            {attackRate}%
          </p>

          <p className="text-xs text-slate-400 mt-2">
            最近 30 分鐘異常流量比例
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">
              主要威脅
            </p>

            <TriangleAlert
              size={24}
              className="text-red-500"
            />
          </div>

          <p
            className="text-2xl font-bold text-slate-900 mt-3 truncate"
            title={topAttack}
          >
            {topAttack}
          </p>

          <p className="text-xs text-slate-400 mt-2">
            最近 30 分鐘主要攻擊類型
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Sparkles
                  size={20}
                  className="text-blue-600"
                />
              </div>

              <div>
                <h3 className="font-semibold text-slate-800">
                  Aegis AI Security Analyst
                </h3>

                <p className="text-sm text-slate-400">
                  智慧型安全事件分析助手
                </p>
              </div>
            </div>

            <span
              className={`text-xs px-3 py-1 rounded-full ${
                aiConnected
                  ? "bg-green-50 text-green-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              {aiConnected ? "LLM 已連接" : "LLM 未連接"}
            </span>
          </div>

          <div className="min-h-[260px] border border-slate-200 rounded-xl p-6 bg-slate-50">
            {aiLoading ? (
              <div className="min-h-[210px] flex flex-col items-center justify-center text-center">
                <RefreshCw
                  size={30}
                  className="text-blue-500 animate-spin mb-4"
                />

                <h4 className="font-semibold text-slate-800">
                  Aegis AI 分析中
                </h4>

                <p className="text-sm text-slate-500 mt-2">
                  正在根據最近 30 分鐘 IDS 偵測結果產生安全分析...
                </p>
              </div>
            ) : error ? (
              <div className="min-h-[210px] flex flex-col items-center justify-center text-center px-8">
                <TriangleAlert
                  size={32}
                  className="text-red-500 mb-4"
                />

                <h4 className="font-semibold text-slate-800">
                  AI 分析失敗
                </h4>

                <p className="text-sm text-red-500 mt-2">
                  {error}
                </p>
              </div>
            ) : analysis ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles
                    size={18}
                    className="text-blue-600"
                  />

                  <p className="font-semibold text-slate-800">
                    Aegis AI 分析結果
                  </p>
                </div>

                <div className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                  {analysis}
                </div>
              </div>
            ) : (
              <div className="min-h-[210px] flex flex-col items-center justify-center text-center px-8">
                <Sparkles
                  size={32}
                  className="text-blue-500 mb-4"
                />

                <h4 className="font-semibold text-slate-800">
                  準備進行安全分析
                </h4>

                <p className="text-sm text-slate-500 mt-2 max-w-lg leading-6">
                  系統會根據最近 30 分鐘 IDS 偵測結果，
                  產生安全摘要、威脅解釋與後續調查建議。
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() =>
              askAI("請分析目前的網路安全狀態，並說明主要威脅與建議。")
            }
            disabled={aiLoading}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={17} />
            {aiLoading ? "分析中..." : "開始 AI 分析"}
          </button>

          <div className="mt-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              詢問 Aegis AI
            </p>

            <div className="flex gap-3">
              <input
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                onKeyDown={handleKeyDown}
                placeholder="請輸入安全分析問題..."
                disabled={aiLoading}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 disabled:bg-slate-100"
              />

              <button
                onClick={handleSubmit}
                disabled={aiLoading || !question.trim()}
                className="px-5 rounded-xl bg-blue-600 text-white flex items-center gap-2 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                <Send size={17} />
                送出
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {suggestedQuestions.map((item) => (
                <button
                  key={item}
                  onClick={() =>
                    handleSuggestedQuestion(item)
                  }
                  disabled={aiLoading}
                  className="text-sm px-3 py-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center gap-2 mb-5">
            <Clock3
              size={19}
              className="text-slate-500"
            />

            <h3 className="font-semibold text-slate-800">
              近期異常事件
            </h3>
          </div>

          {alerts.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              最近 30 分鐘尚無異常事件
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 6).map((alert, index) => (
                <div
                  key={`${alert.captured_at ?? "alert"}-${index}`}
                  className="border border-slate-100 rounded-xl p-3 bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm text-red-500 truncate">
                      {alert.prediction || "Unknown"}
                    </span>

                    <span className="text-xs text-slate-400 shrink-0">
                      {formatTime(alert.captured_at)}
                    </span>
                  </div>

                  {(alert.src_ip || alert.dst_port) && (
                    <p className="text-xs text-slate-500 mt-2 truncate">
                      {alert.src_ip || "--"}
                      {alert.dst_port
                        ? ` → Port ${alert.dst_port}`
                        : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIAnalysis;
