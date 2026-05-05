import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const statusClasses = {
  success: "bg-green-600 text-white",
  waiting_admin_approval: "bg-amber-400 text-amber-950",
  pending_payment: "bg-blue-400 text-blue-950",
  rejected: "bg-red-500 text-white",
  cancelled: "bg-gray-400 text-white"
};

const toDateInput = (date) => date.toISOString().slice(0, 10);

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const endOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
};

const dateDiff = (start, end) => {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);

  return Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
};

const clampBooking = (booking, dates) => {
  const rangeStart = dates[0];
  const rangeEndExclusive = dates[dates.length - 1];
  const start = Math.max(0, dateDiff(rangeStart, booking.startDate));
  const rawEnd = dateDiff(rangeStart, booking.endDate);
  const maxEnd = dateDiff(rangeStart, rangeEndExclusive) + 1;
  const end = Math.min(maxEnd, Math.max(start + 1, rawEnd));

  return {
    columnStart: start + 1,
    span: Math.max(1, end - start)
  };
};

function ReservationCalendar() {
  const [filters, setFilters] = useState({
    startDate: toDateInput(startOfMonth()),
    endDate: toDateInput(endOfMonth()),
    roomType: "all"
  });
  const [grid, setGrid] = useState({ dates: [], roomGroups: [] });
  const [roomTypes, setRoomTypes] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const dayWidth = 108;
  const gridTemplateColumns = useMemo(
    () => `repeat(${grid.dates.length || 1}, minmax(${dayWidth}px, ${dayWidth}px))`,
    [grid.dates.length]
  );
  const roomTypeLabels = useMemo(
    () =>
      Object.fromEntries(
        roomTypes.map((roomType) => [roomType.roomType, roomType.label || roomType.roomType])
      ),
    [roomTypes]
  );

  const loadCalendar = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/calendar/grid", { params: filters });
      setGrid(response.data.data || { dates: [], roomGroups: [] });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reservation calendar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, []);

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

  const handleChange = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reservation Calendar</h1>
          <p className="mt-1 text-sm text-gray-500">Room rows with date-spanning direct booking blocks.</p>
        </div>
        <button type="button" onClick={loadCalendar} disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
          {loading ? "Loading..." : "Apply filters"}
        </button>
      </div>

      <div className="grid gap-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <input name="startDate" type="date" value={filters.startDate} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="endDate" type="date" value={filters.endDate} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <select name="roomType" value={filters.roomType} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="all">All room types</option>
          {roomTypes.map((roomType) => (
            <option key={roomType.roomType} value={roomType.roomType}>
              {roomType.label || roomType.roomType}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-600" /> Success</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400" /> Waiting</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" /> Rejected</span>
        </div>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <div className="min-w-max">
          <div className="sticky top-0 z-20 grid bg-gray-50" style={{ gridTemplateColumns: `180px ${grid.dates.length * dayWidth}px` }}>
            <div className="sticky left-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Room
            </div>
            <div className="grid border-b border-gray-200" style={{ gridTemplateColumns }}>
              {grid.dates.map((date) => (
                <div key={date} className="border-r border-gray-200 px-3 py-2 text-center text-xs font-semibold text-gray-600">
                  <span className="block">{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className="block text-gray-900">{new Date(`${date}T00:00:00`).getDate()}</span>
                </div>
              ))}
            </div>
          </div>

          {grid.roomGroups.map((group) => (
            <div key={group.roomType}>
              <div className="sticky left-0 z-10 border-b border-gray-200 bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {roomTypeLabels[group.roomType] || group.roomType}
              </div>
              {group.rooms.map((room) => (
                <div key={room.roomId} className="grid min-h-16" style={{ gridTemplateColumns: `180px ${grid.dates.length * dayWidth}px` }}>
                  <div className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{room.roomNumber}</p>
                    <p className="text-xs text-gray-500">{room.name}</p>
                  </div>
                  <div className="grid border-b border-gray-200" style={{ gridTemplateColumns }}>
                    {grid.dates.map((date) => (
                      <div key={`${room.roomId}-${date}`} className="min-h-16 border-r border-gray-100" />
                    ))}
                    {room.bookings.map((booking) => {
                      const position = clampBooking(booking, grid.dates);

                      return (
                        <div
                          key={booking.bookingId}
                          className={`z-10 mx-1 my-3 overflow-hidden rounded px-2 py-1 text-xs font-semibold shadow-sm ${statusClasses[booking.status] || "bg-gray-300 text-gray-900"}`}
                          style={{
                            gridColumn: `${position.columnStart} / span ${position.span}`,
                            gridRow: 1
                          }}
                          title={`${booking.guestName} · ${booking.status} · ${booking.checkIn} to ${booking.checkOut}`}
                        >
                          <span className="block truncate">{booking.guestName}</span>
                          <span className="block truncate opacity-90">{room.roomNumber} · {booking.status}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {!grid.roomGroups.length ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              {loading ? "Loading calendar..." : "No rooms or bookings found for this range."}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default ReservationCalendar;
