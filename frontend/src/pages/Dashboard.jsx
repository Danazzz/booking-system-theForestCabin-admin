import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import StatCard from "../components/StatCard";

const initialFilters = {
  roomId: "",
  checkIn: "",
  checkOut: ""
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 1
});

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getInitialSummaryFilters = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: toInputDate(startDate),
    endDate: toInputDate(endDate)
  };
};

function Dashboard() {
  const [summaryFilters, setSummaryFilters] = useState(getInitialSummaryFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [availability, setAvailability] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const totals = useMemo(() => summary?.totals || {}, [summary]);
  const roomTypeBreakdown = summary?.breakdowns?.byRoomType || [];
  const sourceBreakdown = summary?.breakdowns?.bySource || [];
  const waitingApproval =
    Number(totals.waitingAvailabilityApproval || 0) +
    Number(totals.waitingAdminApproval || 0);

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      try {
        const [roomsResponse, summaryResponse] = await Promise.all([
          api.get("/rooms"),
          api.get("/admin/dashboard/summary", { params: getInitialSummaryFilters() })
        ]);

        if (!ignore) {
          const nextRooms = roomsResponse.data.data || [];
          setRooms(nextRooms);
          setSummary(summaryResponse.data.data || null);
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

  const summaryCards = useMemo(
    () => [
      {
        label: "Income",
        value: currencyFormatter.format(totals.revenue || 0)
      },
      {
        label: "Occupancy",
        value: `${numberFormatter.format(totals.occupancyRate || 0)}%`
      },
      {
        label: "Confirmed bookings",
        value: totals.confirmedBookings || 0
      },
      {
        label: "Booked room nights",
        value: `${numberFormatter.format(totals.confirmedRoomNights || 0)} / ${numberFormatter.format(totals.totalRoomNights || 0)}`
      },
      {
        label: "Potential income",
        value: currencyFormatter.format(totals.potentialRevenue || 0)
      },
      {
        label: "Needs attention",
        value: waitingApproval + Number(totals.pendingPayment || 0)
      }
    ],
    [totals, waitingApproval]
  );

  const handleChange = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSummaryChange = (event) => {
    setSummaryFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const refreshSummary = async (event) => {
    event?.preventDefault();
    setError("");
    setSummaryLoading(true);

    try {
      const response = await api.get("/admin/dashboard/summary", {
        params: summaryFilters
      });

      setSummary(response.data.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard summary");
    } finally {
      setSummaryLoading(false);
    }
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Income, occupancy, booking attention, and quick room availability.</p>
        </div>
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

      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={refreshSummary}>
        <input name="startDate" type="date" value={summaryFilters.startDate} onChange={handleSummaryChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="endDate" type="date" value={summaryFilters.endDate} onChange={handleSummaryChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <button type="submit" disabled={summaryLoading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
          {summaryLoading ? "Loading..." : "Apply"}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      {summary?.range ? (
        <div className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 text-sm shadow-sm md:grid-cols-5">
          <p><span className="text-gray-500">Range:</span> <span className="font-medium">{summary.range.startDate} to {summary.range.endDate}</span></p>
          <p><span className="text-gray-500">Nights:</span> <span className="font-medium">{summary.range.nights}</span></p>
          <p><span className="text-gray-500">Active rooms:</span> <span className="font-medium">{totals.activeRooms || 0}</span></p>
          <p><span className="text-gray-500">Waiting approval:</span> <span className="font-medium">{waitingApproval}</span></p>
          <p><span className="text-gray-500">Pending payment:</span> <span className="font-medium">{totals.pendingPayment || 0}</span></p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold">Room Type Breakdown</h2>
          </div>
          <table className="min-w-[760px] divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Room type</th>
                <th className="px-4 py-3">Rooms</th>
                <th className="px-4 py-3">Booked nights</th>
                <th className="px-4 py-3">Available nights</th>
                <th className="px-4 py-3">Occupancy</th>
                <th className="px-4 py-3">Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {roomTypeBreakdown.map((item) => (
                <tr key={item.roomType}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.label}</td>
                  <td className="px-4 py-3">{item.roomCount}</td>
                  <td className="px-4 py-3">{numberFormatter.format(item.bookedRoomNights || 0)}</td>
                  <td className="px-4 py-3">{numberFormatter.format(item.availableRoomNights || 0)}</td>
                  <td className="px-4 py-3">{numberFormatter.format(item.occupancyRate || 0)}%</td>
                  <td className="px-4 py-3">{currencyFormatter.format(item.revenue || 0)}</td>
                </tr>
              ))}
              {!roomTypeBreakdown.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan="6">
                    No active rooms found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="font-semibold">Income by Source</h2>
          </div>
          <table className="min-w-[520px] divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Bookings</th>
                <th className="px-4 py-3">Room nights</th>
                <th className="px-4 py-3">Income</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sourceBreakdown.map((item) => (
                <tr key={item.source}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.sourceName}</td>
                  <td className="px-4 py-3">{item.bookingCount}</td>
                  <td className="px-4 py-3">{numberFormatter.format(item.bookedRoomNights || 0)}</td>
                  <td className="px-4 py-3">{currencyFormatter.format(item.revenue || 0)}</td>
                </tr>
              ))}
              {!sourceBreakdown.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan="4">
                    No confirmed paid bookings in this range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Dashboard;
