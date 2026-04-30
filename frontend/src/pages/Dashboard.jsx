import { useEffect, useState } from "react";
import api from "../api/axios";
import StatCard from "../components/StatCard";

const initialFilters = {
  roomId: "",
  checkIn: "",
  checkOut: ""
};

function Dashboard() {
  const [filters, setFilters] = useState(initialFilters);
  const [availability, setAvailability] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    const response = await api.get("/alerts");
    setAlerts(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadAlerts = async () => {
      try {
        const response = await api.get("/alerts");

        if (!ignore) {
          setAlerts(response.data.data || []);
        }
      } catch {
        if (!ignore) {
          setAlerts([]);
        }
      }
    };

    loadAlerts();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.get("/availability", { params: filters });
      setAvailability(response.data.data);
      await fetchAlerts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Availability summary and active alerts.</p>
      </div>

      <form className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <input
          name="roomId"
          value={filters.roomId}
          onChange={handleChange}
          required
          placeholder="Room ID"
          className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <input
          name="checkIn"
          type="date"
          value={filters.checkIn}
          onChange={handleChange}
          required
          className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <input
          name="checkOut"
          type="date"
          value={filters.checkOut}
          onChange={handleChange}
          required
          className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total rooms" value={availability?.totalRooms} />
        <StatCard label="Booked rooms" value={availability?.bookedRooms} />
        <StatCard label="Available rooms" value={availability?.availableRooms} />
      </div>

      <div className="rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="font-semibold">Alerts</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {alerts.length ? (
            alerts.slice(0, 5).map((alert) => (
              <div key={alert._id} className="px-4 py-3">
                <p className="font-medium text-red-700">{alert.type}</p>
                <p className="text-sm text-gray-700">{alert.message}</p>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-gray-500">No active alerts.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default Dashboard;
