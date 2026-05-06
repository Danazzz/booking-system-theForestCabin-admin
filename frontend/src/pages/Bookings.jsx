import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const statusStyles = {
  waiting_availability_approval: "bg-purple-50 text-purple-700",
  pending_payment: "bg-blue-50 text-blue-700",
  waiting_admin_approval: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600"
};

const sortAccessors = {
  code: (booking) => booking.bookingCode || "",
  guest: (booking) => booking.guestName || "",
  room: (booking) => booking.roomId?.roomNumber || "",
  checkIn: (booking) => booking.checkIn || "",
  checkOut: (booking) => booking.checkOut || "",
  status: (booking) => booking.bookingStatus || "",
  source: (booking) => booking.source || "",
  total: (booking) => booking.totalAmount || 0
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");
const formatSource = (source) =>
  source === "manual_admin" ? "Manual admin" : "Website direct";

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [filters, setFilters] = useState({
    bookingStatus: "",
    roomType: "all",
    source: "all"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const {
    sortedItems,
    sortConfig,
    requestSort
  } = useSortableData(bookings, sortAccessors, { key: "checkIn", direction: "desc" });

  const params = useMemo(() => {
    const next = {};

    if (filters.bookingStatus) {
      next.bookingStatus = filters.bookingStatus;
    }

    if (filters.roomType !== "all") {
      next.roomType = filters.roomType;
    }

    if (filters.source !== "all") {
      next.source = filters.source;
    }

    return next;
  }, [filters]);

  const loadBookings = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/bookings", { params });
      setBookings(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadFilteredBookings = async () => {
      try {
        const response = await api.get("/admin/bookings", { params });

        if (!ignore) {
          setBookings(response.data.data || []);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || "Failed to load bookings");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadFilteredBookings();

    return () => {
      ignore = true;
    };
  }, [params]);

  useEffect(() => {
    let ignore = false;

    const loadRoomTypes = async () => {
      try {
        const response = await api.get("/rooms/types");

        if (!ignore) {
          setRoomTypes(response.data.data || []);
        }
      } catch {
        if (!ignore) {
          setRoomTypes([]);
        }
      }
    };

    loadRoomTypes();

    return () => {
      ignore = true;
    };
  }, []);

  const handleFilterChange = (event) => {
    setLoading(true);
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="mt-1 text-sm text-gray-500">All website and manual admin bookings from the shared backend.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/bookings/new" className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
            Create manual booking
          </Link>
          <Link to="/waiting-approval" className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">
            Waiting approval
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <select name="bookingStatus" value={filters.bookingStatus} onChange={handleFilterChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="">All statuses</option>
          <option value="waiting_availability_approval">Waiting availability approval</option>
          <option value="pending_payment">Pending payment</option>
          <option value="waiting_admin_approval">Waiting admin approval</option>
          <option value="success">Success</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select name="roomType" value={filters.roomType} onChange={handleFilterChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="all">All room types</option>
          {roomTypes.map((roomType) => (
            <option key={roomType.roomType} value={roomType.roomType}>
              {roomType.label || roomType.roomType}
            </option>
          ))}
        </select>
        <select name="source" value={filters.source} onChange={handleFilterChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="all">All sources</option>
          <option value="direct">Website direct</option>
          <option value="manual_admin">Manual admin</option>
        </select>
        <button type="button" onClick={loadBookings} disabled={loading} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:text-gray-400">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1160px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader label="Code" sortKey="code" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Guest" sortKey="guest" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Room" sortKey="room" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Check in" sortKey="checkIn" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Check out" sortKey="checkOut" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Total" sortKey="total" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Source" sortKey="source" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedItems.map((booking) => (
              <tr key={booking._id}>
                <td className="px-4 py-3 font-medium text-gray-900">{booking.bookingCode}</td>
                <td className="px-4 py-3">{booking.guestName}</td>
                <td className="px-4 py-3">
                  {booking.roomId?.roomNumber || "-"} {booking.roomId?.name || booking.roomType}
                </td>
                <td className="px-4 py-3">{formatDate(booking.checkIn)}</td>
                <td className="px-4 py-3">{formatDate(booking.checkOut)}</td>
                <td className="px-4 py-3">{currencyFormatter.format(booking.totalAmount || 0)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[booking.bookingStatus] || "bg-gray-100 text-gray-600"}`}>
                    {booking.bookingStatus}
                  </span>
                </td>
                <td className="px-4 py-3">{formatSource(booking.source)}</td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <p>{booking.latestPayment?.paymentStatus || booking.paymentStatus}</p>
                    {booking.latestPayment?.proofImageUrl ? (
                      <a
                        href={booking.latestPayment.proofImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-800"
                      >
                        View proof
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500">No proof</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/bookings/${booking._id}`} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800">
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
            {!bookings.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="10">
                  {loading ? "Loading bookings..." : "No bookings found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Bookings;
