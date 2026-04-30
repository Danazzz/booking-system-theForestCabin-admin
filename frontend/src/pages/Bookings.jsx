import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  roomId: "",
  channelId: "",
  sourceName: "",
  externalId: "",
  guestName: "",
  guestCount: "",
  roomCount: "",
  checkIn: "",
  checkOut: "",
  price: "",
  promo: "",
  promoCode: "",
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

function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadBookings = async (params = {}) => {
    const response = await api.get("/bookings", { params });
    setBookings(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialBookings = async () => {
      try {
        const response = await api.get("/bookings");

        if (!ignore) {
          setBookings(response.data.data || []);
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

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload = cleanPayload(form);

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
      setError(err.response?.data?.error || "Failed to save booking");
    } finally {
      setLoading(false);
    }
  };

  const editBooking = (booking) => {
    setEditingId(booking._id);
    setForm({
      roomId: booking.roomId?._id || booking.roomId || "",
      channelId: booking.channelId?._id || booking.channelId || "",
      sourceName: booking.sourceName || booking.source || "",
      externalId: booking.externalId || "",
      guestName: booking.guestName || "",
      guestCount: booking.guestCount || "",
      roomCount: booking.roomCount || "",
      checkIn: toDateInput(booking.checkIn),
      checkOut: toDateInput(booking.checkOut),
      price: booking.price || "",
      promo: booking.promo || "",
      promoCode: booking.promoCode || "",
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

  const promoOptions = Array.from(
    new Set(bookings.map((booking) => booking.promo).filter(Boolean))
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-gray-500">Create, edit, and cancel reservations.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <input name="roomId" value={form.roomId} onChange={handleChange} required placeholder="Room ID" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="channelId" value={form.channelId} onChange={handleChange} placeholder="Channel ID" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="sourceName" value={form.sourceName} onChange={handleChange} required placeholder="Channel name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="guestName" value={form.guestName} onChange={handleChange} placeholder="Guest name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="guestCount" type="number" min="1" value={form.guestCount} onChange={handleChange} placeholder="Guest count" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="roomCount" type="number" min="1" value={form.roomCount} onChange={handleChange} required placeholder="Room count" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="externalId" value={form.externalId} onChange={handleChange} placeholder="External ID" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="checkIn" type="date" value={form.checkIn} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="checkOut" type="date" value={form.checkOut} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="price" type="number" min="0" value={form.price} onChange={handleChange} placeholder="Price" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="promo" list="promo-options" value={form.promo} onChange={handleChange} placeholder="Promo" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <datalist id="promo-options">
          {promoOptions.map((promo) => (
            <option key={promo} value={promo} />
          ))}
        </datalist>
        <input name="promoCode" value={form.promoCode} onChange={handleChange} placeholder="Promo code" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notes" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-4" />
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
        <table className="min-w-[900px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Check in</th>
              <th className="px-4 py-3">Check out</th>
              <th className="px-4 py-3">Promo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bookings.map((booking) => (
              <tr key={booking._id}>
                <td className="px-4 py-3">{booking.guestName || "-"}</td>
                <td className="px-4 py-3">{booking.roomId?.name || booking.roomId || "-"}</td>
                <td className="px-4 py-3">{booking.sourceName || booking.source || "-"}</td>
                <td className="px-4 py-3">{booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3">{booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : "-"}</td>
                <td className="px-4 py-3">{booking.promo || booking.promoCode || "-"}</td>
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
                <td className="px-4 py-6 text-center text-gray-500" colSpan="8">
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
