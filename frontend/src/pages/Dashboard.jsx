import { useEffect, useMemo, useState } from "react";
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
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => {
    const waiting = bookings.filter((booking) =>
      ["waiting_availability_approval", "waiting_admin_approval"].includes(booking.bookingStatus)
    ).length;
    const success = bookings.filter((booking) => booking.bookingStatus === "success").length;
    const pendingPayment = bookings.filter((booking) => booking.bookingStatus === "pending_payment").length;

    return { waiting, success, pendingPayment };
  }, [bookings]);

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      try {
        const [roomsResponse, bookingsResponse] = await Promise.all([
          api.get("/rooms"),
          api.get("/admin/bookings")
        ]);

        if (!ignore) {
          const nextRooms = roomsResponse.data.data || [];
          setRooms(nextRooms);
          setBookings(bookingsResponse.data.data || []);
          setFilters((current) => ({
            ...current,
            roomId: current.roomId || nextRooms[0]?._id || ""
          }));
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || "Failed to load dashboard data");
        }
      }
    };

    loadDashboard();

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
      const response = await api.post("/admin/availability/check", filters);
      setAvailability(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to check availability");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Direct booking status and quick room availability check.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Waiting approval" value={stats.waiting} />
        <StatCard label="Confirmed bookings" value={stats.success} />
        <StatCard label="Pending payment" value={stats.pendingPayment} />
      </div>

      <form className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <select name="roomId" value={filters.roomId} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="">Select room</option>
          {rooms.map((room) => (
            <option key={room._id} value={room._id}>
              {room.roomNumber} · {room.name}
            </option>
          ))}
        </select>
        <input name="checkIn" type="date" value={filters.checkIn} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="checkOut" type="date" value={filters.checkOut} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
          {loading ? "Checking..." : "Check availability"}
        </button>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {availability ? (
        <div className={`rounded-md border p-4 text-sm shadow-sm ${availability.available ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {availability.available
            ? "Room is available for the selected dates."
            : "Room is not available for the selected dates."}
        </div>
      ) : null}
    </section>
  );
}

export default Dashboard;
