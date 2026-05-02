import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const emptyForm = {
  roomIds: [],
  channelId: "",
  externalId: "",
  guestName: "",
  guestCount: "",
  checkIn: "",
  checkOut: "",
  price: "",
  promoId: "",
  notes: ""
};

const toDateInput = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
};

const cleanPayload = (form) => {
  const payload = Object.fromEntries(
    Object.entries(form).filter(([, value]) => value !== "")
  );

  if (payload.guestCount !== undefined) {
    payload.guestCount = Number(payload.guestCount);
  }

  if (payload.roomCount !== undefined) {
    payload.roomCount = Number(payload.roomCount);
  }

  if (payload.price !== undefined) {
    payload.price = Number(payload.price);
  }

  return payload;
};

const getBookingRoomsLabel = (booking) => {
  const bookingRooms = booking.roomIds?.length ? booking.roomIds : [booking.roomId].filter(Boolean);

  return bookingRooms.map((room) => {
    if (typeof room === "string") {
      return room;
    }

    return [room.name, room.code].filter(Boolean).join(" ");
  }).join(", ") || "-";
};

const bookingSortAccessors = {
  guest: (booking) => booking.guestName || "",
  room: getBookingRoomsLabel,
  source: (booking) => booking.sourceName || booking.source || "",
  checkIn: (booking) => booking.checkIn,
  checkOut: (booking) => booking.checkOut,
  promo: (booking) => booking.promoId?.name || booking.promo || booking.promoCode || "",
  notes: (booking) => booking.notes || "",
  status: (booking) => booking.status || ""
};

const calculatePromoPrice = (basePrice, promo) => {
  if (!promo || promo.adjustmentType === "none") {
    return basePrice;
  }

  const value = Number(promo.adjustmentValue || 0);

  if (promo.adjustmentType === "percentage_discount") {
    return Math.max(0, basePrice - (basePrice * value / 100));
  }

  if (promo.adjustmentType === "fixed_discount") {
    return Math.max(0, basePrice - value);
  }

  if (promo.adjustmentType === "surcharge") {
    return basePrice + value;
  }

  return basePrice;
};

const formatPromoRule = (promo) => {
  if (!promo || promo.adjustmentType === "none") {
    return "No promo price adjustment";
  }

  const value = Number(promo.adjustmentValue || 0).toLocaleString();

  if (promo.adjustmentType === "percentage_discount") {
    return `${value}% discount applied`;
  }

  if (promo.adjustmentType === "fixed_discount") {
    return `${value} discount applied`;
  }

  if (promo.adjustmentType === "surcharge") {
    return `${value} surcharge applied`;
  }

  return "Promo price adjustment applied";
};

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [channels, setChannels] = useState([]);
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    sortedItems: sortedBookings,
    sortConfig,
    requestSort
  } = useSortableData(bookings, bookingSortAccessors, { key: "checkIn", direction: "asc" });

  const loadBookings = async (params = {}) => {
    const response = await api.get("/bookings", { params });
    setBookings(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialBookings = async () => {
      try {
        const [bookingsResponse, roomsResponse, channelsResponse, promosResponse] = await Promise.all([
          api.get("/bookings"),
          api.get("/rooms"),
          api.get("/channels", { params: { isActive: true } }),
          api.get("/promos", { params: { isActive: true } })
        ]);

        if (!ignore) {
          setBookings(bookingsResponse.data.data || []);
          setRooms((roomsResponse.data.data || []).filter((room) => room.isActive !== false));
          setChannels((channelsResponse.data.data || []).filter((channel) => channel.isActive !== false));
          setPromos(promosResponse.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load bookings");
        }
      }
    };

    loadInitialBookings();

    return () => {
      ignore = true;
    };
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const getPriceForSelection = (roomIds, promoId) => {
    const nextSelectedRooms = rooms.filter((room) => roomIds.includes(room._id));
    const basePrice = nextSelectedRooms.reduce((sum, room) => sum + Number(room.basePrice || 0), 0);
    const promo = promos.find((item) => item._id === promoId);

    return calculatePromoPrice(basePrice, promo);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "promoId" ? { price: String(getPriceForSelection(current.roomIds, value)) } : {})
    }));
  };

  const selectedRooms = rooms.filter((room) => form.roomIds.includes(room._id));
  const calculatedPrice = selectedRooms.reduce((sum, room) => sum + Number(room.basePrice || 0), 0);
  const selectedPromo = promos.find((promo) => promo._id === form.promoId);
  const finalPrice = calculatePromoPrice(calculatedPrice, selectedPromo);

  const handleRoomToggle = (roomId) => {
    setForm((current) => {
      const exists = current.roomIds.includes(roomId);
      const roomIds = exists
        ? current.roomIds.filter((id) => id !== roomId)
        : [...current.roomIds, roomId];
      const nextPrice = getPriceForSelection(roomIds, current.promoId);

      return {
        ...current,
        roomIds,
        price: String(nextPrice)
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (form.roomIds.length === 0) {
        throw new Error("Select at least one room");
      }

      const payload = cleanPayload(form);
      payload.promoId = form.promoId || null;
      payload.roomIds = form.roomIds;
      payload.roomCount = form.roomIds.length;

      if (editingId) {
        await api.patch(`/bookings/${editingId}`, payload);
        setMessage("Booking updated");
      } else {
        await api.post("/bookings", payload);
        setMessage("Booking created");
      }

      resetForm();
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to save booking");
    } finally {
      setLoading(false);
    }
  };

  const formatBookingRooms = (booking) => {
    return getBookingRoomsLabel(booking);
  };

  const editBooking = (booking) => {
    setEditingId(booking._id);
    const bookingRoomIds = booking.roomIds?.length
      ? booking.roomIds.map((room) => room._id || room)
      : [booking.roomId?._id || booking.roomId].filter(Boolean);

    setForm({
      roomIds: bookingRoomIds,
      channelId: booking.channelId?._id || booking.channelId || "",
      externalId: booking.externalId || "",
      guestName: booking.guestName || "",
      guestCount: booking.guestCount || "",
      checkIn: toDateInput(booking.checkIn),
      checkOut: toDateInput(booking.checkOut),
      price: booking.price || "",
      promoId: booking.promoId?.isActive === false
        ? ""
        : booking.promoId?._id || booking.promoId || "",
      notes: booking.notes || ""
    });
  };

  const deleteBooking = async (bookingId) => {
    if (!window.confirm("Cancel this booking?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/bookings/${bookingId}`);
      setMessage("Booking cancelled");
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to cancel booking");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">Create, edit, and cancel reservations.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <div className="rounded-md border border-gray-300 p-3 md:col-span-2">
          <p className="text-sm font-medium text-gray-700">Rooms</p>
          <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
            {rooms.map((room) => (
              <label key={room._id} className="flex min-h-10 items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.roomIds.includes(room._id)}
                  onChange={() => handleRoomToggle(room._id)}
                />
                <span>{room.name} {room.code}</span>
              </label>
            ))}
            {!rooms.length ? <p className="text-sm text-gray-500">No active rooms.</p> : null}
          </div>
        </div>
        <select name="channelId" value={form.channelId} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="">Select source</option>
          {channels.map((channel) => (
            <option key={channel._id} value={channel._id}>{channel.name}</option>
          ))}
        </select>
        <input name="guestName" value={form.guestName} onChange={handleChange} placeholder="Guest name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="guestCount" type="number" min="1" value={form.guestCount} onChange={handleChange} placeholder="Guest count" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input value={`${form.roomIds.length} room${form.roomIds.length === 1 ? "" : "s"} selected`} readOnly className="min-h-11 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none" />
        <input name="externalId" value={form.externalId} onChange={handleChange} placeholder="OTA booking code (optional)" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="checkIn" type="date" value={form.checkIn} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="checkOut" type="date" value={form.checkOut} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="price" type="number" min="0" value={form.price} readOnly placeholder="Price" className="min-h-11 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none" />
        <p className="self-center text-sm text-gray-500">
          Base: {calculatedPrice.toLocaleString()} · Final: {finalPrice.toLocaleString()}
        </p>
        <select name="promoId" value={form.promoId} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="">No promo</option>
          {promos.map((promo) => (
            <option key={promo._id} value={promo._id}>
              {promo.name}
            </option>
          ))}
        </select>
        <p className="self-center text-sm text-gray-500">{formatPromoRule(selectedPromo)}</p>
        <textarea name="notes" value={form.notes} onChange={handleChange} maxLength="500" placeholder="Notes" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-4" />
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-4">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update booking" : "Create booking"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[1040px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader label="Guest" sortKey="guest" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Room" sortKey="room" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Source" sortKey="source" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Check in" sortKey="checkIn" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Check out" sortKey="checkOut" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Promo" sortKey="promo" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Notes" sortKey="notes" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedBookings.map((booking) => (
              <tr key={booking._id}>
                <td className="px-4 py-3">{booking.guestName || "-"}</td>
                <td className="px-4 py-3">{formatBookingRooms(booking)}</td>
                <td className="px-4 py-3">{booking.sourceName || booking.source || "-"}</td>
                <td className="px-4 py-3">{booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3">{booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3">{booking.promoId?.name || booking.promo || booking.promoCode || "-"}</td>
                <td className="max-w-56 truncate px-4 py-3" title={booking.notes || ""}>{booking.notes || "-"}</td>
                <td className="px-4 py-3">{booking.status || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editBooking(booking)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => deleteBooking(booking._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">Cancel</button>
                  </div>
                </td>
              </tr>
            ))}
            {!bookings.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="9">
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
