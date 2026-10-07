import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  Search,
  CheckCircle2,
  Clock3,
  ShieldAlert,
  X,
  Activity,
  Network,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:5000";

function AlertsPage() {
  const [incidents, setIncidents] = useState([]);

  const [summary, setSummary] = useState({
    total: 0,
    open: 0,
    investigating: 0,
    resolved: 0,
    high_risk: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedIncident, setSelectedIncident] = useState(null);

  const [statusFilter, setStatusFilter] = useState("ALL");

  // ==========================================
  // 取得事件
  // ==========================================

  const fetchIncidents = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/incidents`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "取得異常事件失敗"
        );
      }

      setIncidents(
        Array.isArray(data) ? data : []
      );

      // 如果 Drawer 正開著，同步更新內容
      setSelectedIncident((current) => {
        if (!current) return null;

        const updated = data.find(
          (item) => item.id === current.id
        );

        return updated || current;
      });

    } catch (err) {
      console.error(err);

      setError(
        err.message || "取得異常事件失敗"
      );
    }
  };

  // ==========================================
  // 取得統計
  // ==========================================

  const fetchSummary = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/api/incidents/summary`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "取得事件統計失敗"
        );
      }

      setSummary({
        total: Number(data.total || 0),
        open: Number(data.open || 0),
        investigating: Number(
          data.investigating || 0
        ),
        resolved: Number(
          data.resolved || 0
        ),
        high_risk: Number(
          data.high_risk || 0
        ),
      });

    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // 初始化 + Socket
  // ==========================================

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      await Promise.all([
        fetchIncidents(),
        fetchSummary(),
      ]);

      setLoading(false);
    };

    loadData();

    const socket = io(API_BASE);

    // 有新的 Incident 或 Incident 被更新
    const refreshIncidents = () => {
      fetchIncidents();
      fetchSummary();
    };

    socket.on(
      "incident_changed",
      refreshIncidents
    );

    socket.on(
      "incident_updated",
      refreshIncidents
    );

    return () => {
      socket.off(
        "incident_changed",
        refreshIncidents
      );

      socket.off(
        "incident_updated",
        refreshIncidents
      );

      socket.disconnect();
    };
  }, []);

  // ==========================================
  // 修改 Incident 狀態
  // ==========================================

  const updateStatus = async (
    incidentId,
    status
  ) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/incidents/${incidentId}/status`,
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            status,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "更新事件狀態失敗"
        );
      }

      await Promise.all([
        fetchIncidents(),
        fetchSummary(),
      ]);

    } catch (err) {
      console.error(err);

      setError(
        err.message || "更新事件狀態失敗"
      );
    }
  };

  // ==========================================
  // Severity
  // ==========================================

  const getSeverity = (severity) => {
    switch (severity) {
      case "HIGH":
        return {
          text: "高風險",
          className:
            "bg-red-100 text-red-700 border-red-200",
        };

      case "MEDIUM":
        return {
          text: "中風險",
          className:
            "bg-orange-100 text-orange-700 border-orange-200",
        };

      default:
        return {
          text: "低風險",
          className:
            "bg-slate-100 text-slate-600 border-slate-200",
        };
    }
  };

  // ==========================================
  // Status
  // ==========================================

  const getStatus = (status) => {
    switch (status) {
      case "OPEN":
        return {
          text: "待處理",
          className:
            "bg-red-50 text-red-600 border-red-200",
        };

      case "INVESTIGATING":
        return {
          text: "調查中",
          className:
            "bg-blue-50 text-blue-600 border-blue-200",
        };

      case "RESOLVED":
        return {
          text: "已處理",
          className:
            "bg-green-50 text-green-600 border-green-200",
        };

      default:
        return {
          text: status,
          className:
            "bg-slate-50 text-slate-600 border-slate-200",
        };
    }
  };

  // ==========================================
  // Filter
  // ==========================================

  const filteredIncidents =
    statusFilter === "ALL"
      ? incidents
      : incidents.filter(
          (incident) =>
            incident.status === statusFilter
        );

  // ==========================================
  // Loading
  // ==========================================

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow p-10 text-center text-slate-500">
        載入異常事件中...
      </div>
    );
  }

  return (
    <>
      {/* =========================
          Header
      ========================= */}

      <div className="mb-6">

        <div className="flex items-center gap-3">

          <ShieldAlert
            size={28}
            className="text-red-500"
          />

          <h2 className="text-2xl font-bold text-slate-800">
            異常事件
          </h2>

        </div>

        <p className="text-sm text-slate-500 mt-2">
          安全事件調查與處理中心
        </p>

      </div>

      {/* =========================
          Error
      ========================= */}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-4">
          {error}
        </div>
      )}

      {/* =========================
          Summary Cards
      ========================= */}

      <div className="grid grid-cols-4 gap-5 mb-7">

        {/* OPEN */}

        <div className="bg-white rounded-2xl shadow p-5">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                待處理
              </p>

              <p className="text-3xl font-bold text-red-500 mt-2">
                {summary.open}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle
                size={23}
                className="text-red-500"
              />
            </div>

          </div>

        </div>

        {/* INVESTIGATING */}

        <div className="bg-white rounded-2xl shadow p-5">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                調查中
              </p>

              <p className="text-3xl font-bold text-blue-600 mt-2">
                {summary.investigating}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
              <Search
                size={23}
                className="text-blue-600"
              />
            </div>

          </div>

        </div>

        {/* RESOLVED */}

        <div className="bg-white rounded-2xl shadow p-5">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                已處理
              </p>

              <p className="text-3xl font-bold text-green-600 mt-2">
                {summary.resolved}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle2
                size={23}
                className="text-green-600"
              />
            </div>

          </div>

        </div>

        {/* HIGH */}

        <div className="bg-white rounded-2xl shadow p-5">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm text-slate-500">
                未處理高風險
              </p>

              <p className="text-3xl font-bold text-red-600 mt-2">
                {summary.high_risk}
              </p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
              <ShieldAlert
                size={23}
                className="text-red-600"
              />
            </div>

          </div>

        </div>

      </div>

      {/* =========================
          Incident List
      ========================= */}

      <div className="bg-white rounded-2xl shadow">

        {/* List Header */}

        <div className="p-6 border-b border-slate-200">

          <div className="flex items-center justify-between">

            <div>

              <h3 className="text-lg font-semibold text-slate-800">
                安全事件
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                相同來源、目標與攻擊類型將聚合為單一事件
              </p>

            </div>

            {/* Filter */}

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="
                border
                border-slate-300
                rounded-lg
                px-4
                py-2
                text-sm
                outline-none
                bg-white
              "
            >
              <option value="ALL">
                全部事件
              </option>

              <option value="OPEN">
                待處理
              </option>

              <option value="INVESTIGATING">
                調查中
              </option>

              <option value="RESOLVED">
                已處理
              </option>

            </select>

          </div>

        </div>

        {/* Empty */}

        {filteredIncidents.length === 0 ? (

          <div className="py-16 text-center">

            <ShieldAlert
              size={40}
              className="mx-auto text-slate-300"
            />

            <p className="text-slate-500 mt-4">
              目前沒有符合條件的安全事件
            </p>

          </div>

        ) : (

          <div className="divide-y divide-slate-100">

            {filteredIncidents.map(
              (incident) => {

                const severity =
                  getSeverity(
                    incident.severity
                  );

                const status =
                  getStatus(
                    incident.status
                  );

                return (
                  <div
                    key={incident.id}
                    className="
                      p-6
                      hover:bg-slate-50
                      transition
                    "
                  >

                    <div className="flex items-center justify-between gap-6">

                      {/* Left */}

                      <div className="flex items-start gap-4 min-w-0">

                        <div
                          className={`
                            w-11
                            h-11
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            shrink-0
                            ${
                              incident.severity ===
                              "HIGH"
                                ? "bg-red-50"
                                : incident.severity ===
                                  "MEDIUM"
                                ? "bg-orange-50"
                                : "bg-slate-100"
                            }
                          `}
                        >

                          <AlertTriangle
                            size={22}
                            className={
                              incident.severity ===
                              "HIGH"
                                ? "text-red-500"
                                : incident.severity ===
                                  "MEDIUM"
                                ? "text-orange-500"
                                : "text-slate-500"
                            }
                          />

                        </div>

                        <div className="min-w-0">

                          {/* Name */}

                          <div className="flex items-center gap-3 flex-wrap">

                            <h4 className="text-lg font-semibold text-slate-800">
                              {incident.attack_type}
                            </h4>

                            <span
                              className={`
                                text-xs
                                px-2.5
                                py-1
                                rounded-full
                                border
                                font-medium
                                ${severity.className}
                              `}
                            >
                              {severity.text}
                            </span>

                            <span
                              className={`
                                text-xs
                                px-2.5
                                py-1
                                rounded-full
                                border
                                font-medium
                                ${status.className}
                              `}
                            >
                              {status.text}
                            </span>

                          </div>

                          {/* Network */}

                          <div className="flex items-center gap-2 text-sm text-slate-600 mt-3">

                            <Network size={15} />

                            <span>
                              {incident.src_ip}
                            </span>

                            <span className="text-slate-400">
                              →
                            </span>

                            <span>
                              {incident.dst_ip}
                              {incident.dst_port
                                ? `:${incident.dst_port}`
                                : ""}
                            </span>

                          </div>

                          {/* Information */}

                          <div className="flex items-center gap-5 mt-3 text-xs text-slate-500">

                            <span className="flex items-center gap-1">
                              <Activity size={14} />

                              偵測{" "}
                              {incident.event_count}{" "}
                              次
                            </span>

                            <span className="flex items-center gap-1">
                              <Clock3 size={14} />

                              最後發現：
                              {incident.last_seen}
                            </span>

                          </div>

                        </div>

                      </div>

                      {/* Button */}

                      <button
                        onClick={() =>
                          setSelectedIncident(
                            incident
                          )
                        }
                        className="
                          shrink-0
                          px-4
                          py-2
                          rounded-lg
                          border
                          border-slate-300
                          text-sm
                          text-slate-700
                          hover:bg-slate-100
                          transition
                        "
                      >
                        查看事件 →
                      </button>

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

      </div>

      {/* =========================
          Drawer
      ========================= */}

      {selectedIncident && (
        <>

          {/* Overlay */}

          <div
            onClick={() =>
              setSelectedIncident(null)
            }
            className="
              fixed
              inset-0
              bg-black/30
              z-[60]
            "
          />

          {/* Drawer */}

          <div
            className="
              fixed
              right-0
              top-0
              h-screen
              w-[460px]
              bg-white
              shadow-2xl
              z-[70]
              overflow-y-auto
            "
          >

            {/* Drawer Header */}

            <div className="p-6 border-b border-slate-200">

              <div className="flex items-start justify-between">

                <div>

                  <p className="text-sm text-slate-500">
                    安全事件 #
                    {selectedIncident.id}
                  </p>

                  <h2 className="text-2xl font-bold text-slate-800 mt-1">
                    {
                      selectedIncident.attack_type
                    }
                  </h2>

                </div>

                <button
                  onClick={() =>
                    setSelectedIncident(null)
                  }
                  className="
                    p-2
                    rounded-lg
                    hover:bg-slate-100
                  "
                >
                  <X size={21} />
                </button>

              </div>

              {/* Tags */}

              <div className="flex gap-2 mt-4">

                <span
                  className={`
                    text-xs
                    px-3
                    py-1.5
                    rounded-full
                    border
                    font-medium
                    ${
                      getSeverity(
                        selectedIncident.severity
                      ).className
                    }
                  `}
                >
                  {
                    getSeverity(
                      selectedIncident.severity
                    ).text
                  }
                </span>

                <span
                  className={`
                    text-xs
                    px-3
                    py-1.5
                    rounded-full
                    border
                    font-medium
                    ${
                      getStatus(
                        selectedIncident.status
                      ).className
                    }
                  `}
                >
                  {
                    getStatus(
                      selectedIncident.status
                    ).text
                  }
                </span>

              </div>

            </div>

            {/* Drawer Body */}

            <div className="p-6">

              <h3 className="font-semibold text-slate-800 mb-4">
                事件資訊
              </h3>

              <div className="grid grid-cols-2 gap-4">

                <InfoBox
                  title="來源 IP"
                  value={
                    selectedIncident.src_ip
                  }
                />

                <InfoBox
                  title="目的 IP"
                  value={
                    selectedIncident.dst_ip
                  }
                />

                <InfoBox
                  title="目的 Port"
                  value={
                    selectedIncident.dst_port ||
                    "-"
                  }
                />

                <InfoBox
                  title="Protocol"
                  value={
                    selectedIncident.protocol ||
                    "-"
                  }
                />

                <InfoBox
                  title="偵測次數"
                  value={`${selectedIncident.event_count} 次`}
                />

                <InfoBox
                  title="風險等級"
                  value={
                    getSeverity(
                      selectedIncident.severity
                    ).text
                  }
                />

              </div>

              {/* Time */}

              <div className="mt-7">

                <h3 className="font-semibold text-slate-800 mb-4">
                  時間資訊
                </h3>

                <div className="space-y-4">

                  <TimeRow
                    title="首次發現"
                    value={
                      selectedIncident.first_seen
                    }
                  />

                  <TimeRow
                    title="最後發現"
                    value={
                      selectedIncident.last_seen
                    }
                  />

                </div>

              </div>

              {/* Status */}

              <div className="mt-8">

                <h3 className="font-semibold text-slate-800">
                  事件處理
                </h3>

                <p className="text-sm text-slate-500 mt-1 mb-4">
                  更新目前事件的調查狀態
                </p>

                <div className="space-y-3">

                  <button
                    onClick={() =>
                      updateStatus(
                        selectedIncident.id,
                        "OPEN"
                      )
                    }
                    className="
                      w-full
                      border
                      border-red-200
                      bg-red-50
                      text-red-600
                      rounded-xl
                      py-3
                      font-medium
                      hover:bg-red-100
                      transition
                    "
                  >
                    標記為待處理
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(
                        selectedIncident.id,
                        "INVESTIGATING"
                      )
                    }
                    className="
                      w-full
                      border
                      border-blue-200
                      bg-blue-50
                      text-blue-600
                      rounded-xl
                      py-3
                      font-medium
                      hover:bg-blue-100
                      transition
                    "
                  >
                    標記為調查中
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(
                        selectedIncident.id,
                        "RESOLVED"
                      )
                    }
                    className="
                      w-full
                      border
                      border-green-200
                      bg-green-50
                      text-green-600
                      rounded-xl
                      py-3
                      font-medium
                      hover:bg-green-100
                      transition
                    "
                  >
                    標記為已處理
                  </button>

                </div>

              </div>

            </div>

          </div>

        </>
      )}
    </>
  );
}


// ==========================================
// Information Box
// ==========================================

function InfoBox({ title, value }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">

      <p className="text-xs text-slate-500">
        {title}
      </p>

      <p className="font-semibold text-slate-800 mt-1 break-all">
        {value}
      </p>

    </div>
  );
}


// ==========================================
// Time Row
// ==========================================

function TimeRow({ title, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3">

      <span className="text-sm text-slate-500">
        {title}
      </span>

      <span className="text-sm font-medium text-slate-700">
        {value}
      </span>

    </div>
  );
}


export default AlertsPage;