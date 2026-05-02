import { useEffect, useState } from "react";
import api from "../api/axios";
import { useSortableData } from "../hooks/useSortableData";

const alertSortAccessors = {
  createdAt: (alert) => alert.createdAt || "",
  type: (alert) => alert.type || "",
  severity: (alert) => alert.severity || "",
  room: (alert) => alert.roomId?.name || alert.roomId?.code || "",
  message: (alert) => alert.message || ""
};

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    sortedItems: sortedAlerts,
    sortConfig,
    requestSort
  } = useSortableData(alerts, alertSortAccessors, { key: "createdAt", direction: "desc" });

  const fetchAlerts = async () => {
    setError("");
    setLoading(true);

    try {
      const response = await api.get("/alerts");
      setAlerts(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadAlerts = async () => {
      try {
        const response = await api.get("/alerts");

        if (!ignore) {
          setAlerts(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load alerts");
        }
      }
    };

    loadAlerts();

    return () => {
      ignore = true;
    };
  }, []);

  const markAsRead = async (id) => {
    await api.patch(`/alerts/${id}/read`);
    await fetchAlerts();
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="mt-1 text-sm text-gray-500">Active booking and sync warnings.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={sortConfig.key}
            onChange={(event) => requestSort(event.target.value)}
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          >
            <option value="createdAt">Created date</option>
            <option value="type">Type</option>
            <option value="severity">Severity</option>
            <option value="room">Room</option>
            <option value="message">Message</option>
          </select>
          <button
            type="button"
            onClick={() => requestSort(sortConfig.key)}
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
          >
            {sortConfig.direction === "asc" ? "Asc" : "Desc"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        {sortedAlerts.map((alert) => (
          <div key={alert._id} className="rounded-md border border-red-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-red-700">{alert.type}</p>
                <p className="mt-1 text-sm text-gray-800">{alert.message}</p>
                <p className="mt-2 text-xs text-gray-500">
                  {alert.roomId?.name || "Room"} · {alert.severity}
                </p>
              </div>
              <button
                type="button"
                onClick={() => markAsRead(alert._id)}
                className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Mark as read
              </button>
            </div>
          </div>
        ))}
        {!alerts.length ? (
          <div className="rounded-md border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 shadow-sm">
            {loading ? "Loading alerts..." : "No active alerts."}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default Alerts;
