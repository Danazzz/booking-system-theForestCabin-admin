import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

const emptyForm = {
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  roomType: "",
  roomId: "",
  roomCount: 1,
  checkIn: "",
  checkOut: "",
  numberOfGuests: 2,
  numberOfChildren: 0,
  promoId: "",
  source: "",
  sourceName: "",
  bookingStatus: "pending_payment",
  paymentStatus: "unpaid",
  overrideTotal: false,
  totalAmount: "",
  adminNote: ""
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const formatRoomType = (roomType) =>
  String(roomType || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const startDate = new Date(checkIn);
  const endDate = new Date(checkOut);
  const diff = endDate.getTime() - startDate.getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const applyPromoPricing = (subtotal, promo) => {
  if (!promo || subtotal <= 0) {
    return subtotal;
  }

  const value = Number(promo.adjustmentValue || 0);

  if (promo.adjustmentType === "percentage_discount") {
    return subtotal - subtotal * Math.min(value, 100) / 100;
  }

  if (promo.adjustmentType === "fixed_discount") {
    return subtotal - value;
  }

  if (promo.adjustmentType === "bundle_price") {
    return value;
  }

  if (promo.adjustmentType === "surcharge") {
    return subtotal + value;
  }

  return subtotal;
};

const isPromoEligible = (promo, { nights, roomType, totalRooms = 1 }) => {
  if (!promo) {
    return true;
  }

  const stayNights = Number(nights || 0);
  const minNights = Number(promo.minNights || 0);
  const maxNights = Number(promo.maxNights || 0);
  const minRooms = Number(promo.minRooms || 0);
  const eligibleRoomTypes = Array.isArray(promo.eligibleRoomTypes)
    ? promo.eligibleRoomTypes
    : [];

  if (minNights > 0 && stayNights < minNights) {
    return false;
  }

  if (maxNights > 0 && stayNights > maxNights) {
    return false;
  }

  if (minRooms > 0 && Number(totalRooms || 0) < minRooms) {
    return false;
  }

  if (eligibleRoomTypes.length > 0 && !eligibleRoomTypes.includes(roomType)) {
    return false;
  }

  return true;
};

const getPromoEligibilityMessage = (promo, { nights, roomType, totalRooms = 1 }) => {
  const stayNights = Number(nights || 0);
  const minNights = Number(promo?.minNights || 0);
  const maxNights = Number(promo?.maxNights || 0);
  const minRooms = Number(promo?.minRooms || 0);
  const eligibleRoomTypes = Array.isArray(promo?.eligibleRoomTypes)
    ? promo.eligibleRoomTypes
    : [];

  if (minNights > 0 && stayNights < minNights) {
    return `minimum ${minNights} night${minNights > 1 ? "s" : ""}`;
  }

  if (maxNights > 0 && stayNights > maxNights) {
    return `maximum ${maxNights} night${maxNights > 1 ? "s" : ""}`;
  }

  if (minRooms > 0 && Number(totalRooms || 0) < minRooms) {
    return `minimum ${minRooms} room${minRooms > 1 ? "s" : ""}`;
  }

  if (eligibleRoomTypes.length > 0 && !eligibleRoomTypes.includes(roomType)) {
    return `only for ${eligibleRoomTypes.map(formatRoomType).join(", ")}`;
  }

  return "";
};

const formatPromoRestrictions = (promo) => {
  const rules = [];
  const minNights = Number(promo?.minNights || 0);
  const maxNights = Number(promo?.maxNights || 0);
  const minRooms = Number(promo?.minRooms || 0);
  const eligibleRoomTypes = Array.isArray(promo?.eligibleRoomTypes)
    ? promo.eligibleRoomTypes
    : [];

  if (minNights > 0) {
    rules.push(`min ${minNights} night${minNights > 1 ? "s" : ""}`);
  }

  if (maxNights > 0) {
    rules.push(`max ${maxNights} night${maxNights > 1 ? "s" : ""}`);
  }

  if (minRooms > 0) {
    rules.push(`min ${minRooms} room${minRooms > 1 ? "s" : ""}`);
  }

  if (eligibleRoomTypes.length > 0) {
    rules.push(eligibleRoomTypes.map(formatRoomType).join(", "));
  }

  return rules.join(" · ");
};

function CreateManualBooking() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [rooms, setRooms] = useState([]);
  const [promos, setPromos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const roomTypes = useMemo(() => {
    const map = new Map();

    rooms.forEach((room) => {
      if (!map.has(room.roomType)) {
        map.set(room.roomType, formatRoomType(room.roomType));
      }
    });

    return Array.from(map.entries()).map(([roomType, label]) => ({ roomType, label }));
  }, [rooms]);

  const filteredRooms = useMemo(
    () => rooms.filter((room) => !form.roomType || room.roomType === form.roomType),
    [form.roomType, rooms]
  );

  const selectedRoom =
    rooms.find((room) => room._id === form.roomId) || filteredRooms[0] || null;
  const selectedPromo = promos.find((promo) => promo._id === form.promoId) || null;
  const selectedChannel = channels.find((channel) => channel.key === form.source) || null;
  const nights = getNights(form.checkIn, form.checkOut);
  const roomCount = Math.max(1, Number(form.roomCount || 1));
  const calculatedSubtotal = nights * Number(selectedRoom?.basePrice || 0) * roomCount;
  const selectedPromoIsEligible = isPromoEligible(selectedPromo, {
    nights,
    roomType: selectedRoom?.roomType,
    totalRooms: roomCount
  });
  const activeSelectedPromo = selectedPromoIsEligible ? selectedPromo : null;
  const calculatedTotal = Math.max(
    0,
    Math.round(applyPromoPricing(calculatedSubtotal, activeSelectedPromo))
  );
  const finalTotal = form.overrideTotal
    ? Number(form.totalAmount || 0)
    : calculatedTotal;

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const [roomsResponse, promosResponse, channelsResponse] = await Promise.all([
          api.get("/rooms", { params: { status: "active" } }),
          api.get("/promos/active"),
          api.get("/channels")
        ]);

        if (!ignore) {
          const nextRooms = roomsResponse.data.data || [];
          const nextChannels = channelsResponse.data.data || [];
          setRooms(nextRooms);
          setPromos(promosResponse.data.data || []);
          setChannels(nextChannels);
          setForm((current) => ({
            ...current,
            roomType: current.roomType || nextRooms[0]?.roomType || "",
            roomId: current.roomId || nextRooms[0]?._id || "",
            source: current.source || nextChannels[0]?.key || "",
            sourceName: current.sourceName || nextChannels[0]?.name || ""
          }));
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, "Failed to load manual booking data"));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value
      };

      if (name === "roomType") {
        const firstRoom = rooms.find((room) => room.roomType === value);
        next.roomId = firstRoom?._id || "";
      }

      if (name === "roomCount" && Number(value) > 1) {
        next.roomId = "";
      }

      if (name === "bookingStatus" && value === "success") {
        next.paymentStatus = "paid";
      }

      if (name === "bookingStatus" && value === "pending_payment") {
        next.paymentStatus = "unpaid";
      }

      if (name === "source") {
        const channel = channels.find((item) => item.key === value);
        next.sourceName = channel?.name || "";
      }

      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const payload = {
        ...form,
        roomType: selectedRoom?.roomType || form.roomType,
        roomId: roomCount === 1 ? form.roomId || selectedRoom?._id : undefined,
        roomCount,
        roomItems: [
          {
            roomType: selectedRoom?.roomType || form.roomType,
            roomCount,
            adultGuests: Number(form.numberOfGuests),
            childGuests: Number(form.numberOfChildren || 0)
          }
        ],
        numberOfGuests: Number(form.numberOfGuests),
        numberOfChildren: Number(form.numberOfChildren || 0),
        numberOfRooms: roomCount,
        totalAmount: Number(finalTotal || 0),
        overrideTotal: Boolean(form.overrideTotal),
        promoId: activeSelectedPromo?._id || undefined,
        source: selectedChannel?.key || form.source,
        sourceName: selectedChannel?.name || form.sourceName
      };

      const response = await api.post("/admin/bookings/manual", payload);
      const booking = response.data.data;

      setMessage("Manual booking created");
      navigate(`/bookings/${booking._id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create manual booking"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Create Manual Booking</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add bookings received directly by admin, WhatsApp, phone, or walk-in.
          </p>
        </div>
        <Link to="/bookings" className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">
          Back to bookings
        </Link>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Guest</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input name="guestName" value={form.guestName} onChange={handleChange} required placeholder="Guest name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="guestPhone" value={form.guestPhone} onChange={handleChange} required placeholder="Phone / WhatsApp" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="guestEmail" type="email" value={form.guestEmail} onChange={handleChange} placeholder="Email optional" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <select name="source" value={form.source} onChange={handleChange} required disabled={loading || channels.length === 0} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3">
              {channels.length ? (
                channels.map((channel) => (
                  <option key={channel._id} value={channel.key}>
                    {channel.name}
                  </option>
                ))
              ) : (
                <option value="">Add booking channels first</option>
              )}
            </select>
          </div>
          {channels.length === 0 ? (
            <p className="mt-3 text-sm text-amber-700">
              Create booking sources in Channels before recording manual bookings.
            </p>
          ) : null}
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Stay</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <select name="roomType" value={form.roomType} onChange={handleChange} disabled={loading || roomTypes.length === 0} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
              {roomTypes.map((roomType) => (
                <option key={roomType.roomType} value={roomType.roomType}>{roomType.label}</option>
              ))}
            </select>
            <select name="roomId" value={form.roomId} onChange={handleChange} disabled={loading || filteredRooms.length === 0 || roomCount > 1} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
              {roomCount > 1 ? <option value="">Auto assign {roomCount} rooms</option> : null}
              {filteredRooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.roomNumber} · {room.name}
                </option>
              ))}
            </select>
            <input name="roomCount" type="number" min="1" value={form.roomCount} onChange={handleChange} required placeholder="Rooms" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="checkIn" type="date" value={form.checkIn} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="checkOut" type="date" value={form.checkOut} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="numberOfGuests" type="number" min="1" value={form.numberOfGuests} onChange={handleChange} required placeholder="Adults" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="numberOfChildren" type="number" min="0" value={form.numberOfChildren} onChange={handleChange} placeholder="Children" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <select name="promoId" value={selectedPromo && selectedPromoIsEligible ? form.promoId : ""} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2">
              <option value="">No promo</option>
              {promos.map((promo) => {
                const eligible = isPromoEligible(promo, {
                  nights,
                  roomType: selectedRoom?.roomType,
                  totalRooms: roomCount
                });
                const restriction = formatPromoRestrictions(promo);
                const reason = getPromoEligibilityMessage(promo, {
                  nights,
                  roomType: selectedRoom?.roomType,
                  totalRooms: roomCount
                });

                return (
                  <option key={promo._id} value={promo._id} disabled={!eligible}>
                    {promo.name}
                    {restriction ? ` (${restriction})` : ""}
                    {!eligible && reason ? ` - ${reason}` : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Status & Pricing</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <select name="bookingStatus" value={form.bookingStatus} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
              <option value="pending_payment">Pending payment</option>
              <option value="success">Success</option>
            </select>
            <div className="flex min-h-11 items-center rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              Payment: {form.bookingStatus === "success" ? "Paid" : "Unpaid"}
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <input name="overrideTotal" type="checkbox" checked={form.overrideTotal} onChange={handleChange} />
              Override total
            </label>
            <input name="totalAmount" type="number" min="0" value={form.overrideTotal ? form.totalAmount : String(calculatedTotal || "")} onChange={handleChange} disabled={!form.overrideTotal} placeholder="Total amount" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 disabled:bg-gray-100 md:col-span-3" />
          </div>
          <div className="mt-4 grid gap-3 rounded-md bg-gray-50 p-4 text-sm md:grid-cols-4">
            <p><span className="text-gray-500">Nights:</span> <span className="font-medium">{nights}</span></p>
            <p><span className="text-gray-500">Rooms:</span> <span className="font-medium">{roomCount}</span></p>
            <p><span className="text-gray-500">Base price:</span> <span className="font-medium">{currencyFormatter.format(selectedRoom?.basePrice || 0)}</span></p>
            <p><span className="text-gray-500">Calculated:</span> <span className="font-medium">{currencyFormatter.format(calculatedTotal)}</span></p>
            <p><span className="text-gray-500">Final:</span> <span className="font-medium">{currencyFormatter.format(finalTotal || 0)}</span></p>
          </div>
          {activeSelectedPromo ? (
            <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Promo applied: {activeSelectedPromo.name}
              {formatPromoRestrictions(activeSelectedPromo)
                ? ` · ${formatPromoRestrictions(activeSelectedPromo)}`
                : ""}
            </p>
          ) : null}
          <textarea name="adminNote" value={form.adminNote} onChange={handleChange} placeholder="Admin note" className="mt-4 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        </div>

        <button type="submit" disabled={saving || loading || rooms.length === 0 || channels.length === 0} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
          {saving ? "Creating..." : "Create manual booking"}
        </button>
      </form>
    </section>
  );
}

export default CreateManualBooking;
