import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";

const createRoomItem = (overrides = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  roomType: "",
  roomId: "",
  roomCount: 1,
  adultGuests: 2,
  childGuests: 0,
  ...overrides
});

const emptyForm = {
  guestName: "",
  guestEmail: "",
  guestPhone: "",
  checkIn: "",
  checkOut: "",
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

const sumTopValues = (values, count) =>
  [...values]
    .sort((left, right) => Number(right || 0) - Number(left || 0))
    .slice(0, count)
    .reduce((total, value) => total + Number(value || 0), 0);

const normalizePromoRoomTypes = ({ roomType, roomTypes = [] }) => {
  const requestedRoomTypes = roomTypes.length ? roomTypes : roomType ? [roomType] : [];

  return requestedRoomTypes.filter(Boolean);
};

const isPromoEligible = (promo, { nights, roomType, roomTypes = [], totalRooms = 1 }) => {
  if (!promo) {
    return true;
  }

  const stayNights = Number(nights || 0);
  const minNights = Number(promo.minNights || 0);
  const maxNights = Number(promo.maxNights || 0);
  const minRooms = Number(promo.minRooms || 0);
  const requestedRoomTypes = normalizePromoRoomTypes({ roomType, roomTypes });
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

  if (
    eligibleRoomTypes.length > 0 &&
    requestedRoomTypes.some((requestedRoomType) => !eligibleRoomTypes.includes(requestedRoomType))
  ) {
    return false;
  }

  return true;
};

const getPromoEligibilityMessage = (
  promo,
  { nights, roomType, roomTypes = [], totalRooms = 1 }
) => {
  const stayNights = Number(nights || 0);
  const minNights = Number(promo?.minNights || 0);
  const maxNights = Number(promo?.maxNights || 0);
  const minRooms = Number(promo?.minRooms || 0);
  const requestedRoomTypes = normalizePromoRoomTypes({ roomType, roomTypes });
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

  if (
    eligibleRoomTypes.length > 0 &&
    requestedRoomTypes.some((requestedRoomType) => !eligibleRoomTypes.includes(requestedRoomType))
  ) {
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

const buildRoomTypeProfiles = (rooms) => {
  const map = new Map();

  rooms.forEach((room) => {
    const current = map.get(room.roomType) || {
      roomType: room.roomType,
      label: formatRoomType(room.roomType),
      rooms: [],
      basePrice: Number(room.basePrice || 0)
    };

    current.rooms.push(room);
    current.basePrice = Math.min(current.basePrice, Number(room.basePrice || 0));
    map.set(room.roomType, current);
  });

  map.forEach((profile) => {
    profile.rooms.sort((left, right) =>
      String(left.roomNumber || "").localeCompare(String(right.roomNumber || ""), undefined, {
        numeric: true
      })
    );
  });

  return map;
};

function CreateManualBooking() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [roomItems, setRoomItems] = useState([createRoomItem()]);
  const [rooms, setRooms] = useState([]);
  const [promos, setPromos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const roomTypeProfiles = useMemo(() => buildRoomTypeProfiles(rooms), [rooms]);
  const roomTypes = useMemo(
    () =>
      Array.from(roomTypeProfiles.values()).map((profile) => ({
        roomType: profile.roomType,
        label: profile.label
      })),
    [roomTypeProfiles]
  );

  const nights = getNights(form.checkIn, form.checkOut);
  const selectedChannel = channels.find((channel) => channel.key === form.source) || null;

  const pricedRoomItems = useMemo(
    () =>
      roomItems.map((item) => {
        const profile = roomTypeProfiles.get(item.roomType) || null;
        const roomsForType = profile?.rooms || [];
        const roomCount = Math.max(1, Number(item.roomCount || 1));
        const selectedRoom = roomsForType.find((room) => room._id === item.roomId) || null;
        const adultGuests = Math.max(0, Number(item.adultGuests || 0));
        const childGuests = Math.max(0, Number(item.childGuests || 0));
        const adultCapacity = sumTopValues(
          roomsForType.map((room) => room.capacity),
          roomCount
        );
        const childCapacity = sumTopValues(
          roomsForType.map((room) => room.childCapacity),
          roomCount
        );
        const basePrice = Number(profile?.basePrice || selectedRoom?.basePrice || 0);

        return {
          ...item,
          profile,
          roomsForType,
          selectedRoom,
          roomCount,
          adultGuests,
          childGuests,
          adultCapacity,
          childCapacity,
          basePrice,
          subtotal: nights * basePrice * roomCount
        };
      }),
    [nights, roomItems, roomTypeProfiles]
  );

  const totalRooms = pricedRoomItems.reduce((total, item) => total + item.roomCount, 0);
  const totalAdults = pricedRoomItems.reduce((total, item) => total + item.adultGuests, 0);
  const totalChildren = pricedRoomItems.reduce((total, item) => total + item.childGuests, 0);
  const selectedRoomTypes = pricedRoomItems.map((item) => item.roomType).filter(Boolean);
  const calculatedSubtotal = pricedRoomItems.reduce((total, item) => total + item.subtotal, 0);
  const selectedPromo = promos.find((promo) => promo._id === form.promoId) || null;
  const selectedPromoIsEligible = isPromoEligible(selectedPromo, {
    nights,
    roomTypes: selectedRoomTypes,
    totalRooms
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
          const firstRoom = nextRooms[0] || null;

          setRooms(nextRooms);
          setPromos(promosResponse.data.data || []);
          setChannels(nextChannels);
          setRoomItems([
            createRoomItem({
              roomType: firstRoom?.roomType || "",
              roomId: firstRoom?._id || ""
            })
          ]);
          setForm((current) => ({
            ...current,
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

  const handleRoomItemChange = (itemId, field, value) => {
    setRoomItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const next = {
          ...item,
          [field]: ["roomCount", "adultGuests", "childGuests"].includes(field)
            ? Math.max(field === "roomCount" ? 1 : 0, Number(value || 0))
            : value
        };

        if (field === "roomType") {
          const firstRoom = rooms.find((room) => room.roomType === value);
          next.roomId = firstRoom?._id || "";
        }

        if (field === "roomCount" && Number(value) > 1) {
          next.roomId = "";
        }

        return next;
      })
    );
  };

  const addRoomItem = () => {
    const firstRoom = rooms[0] || null;

    setRoomItems((currentItems) => [
      ...currentItems,
      createRoomItem({
        roomType: firstRoom?.roomType || "",
        roomId: firstRoom?._id || "",
        adultGuests: 1
      })
    ]);
  };

  const removeRoomItem = (itemId) => {
    setRoomItems((currentItems) =>
      currentItems.length === 1
        ? currentItems
        : currentItems.filter((item) => item.id !== itemId)
    );
  };

  const validateForm = () => {
    if (nights <= 0) {
      return "Check-out must be later than check-in.";
    }

    if (!pricedRoomItems.length) {
      return "Add at least one room type.";
    }

    if (totalAdults <= 0) {
      return "Enter at least one adult guest.";
    }

    for (const item of pricedRoomItems) {
      if (!item.roomType || !item.profile) {
        return "Select an active room type for every room row.";
      }

      if (item.roomCount > item.roomsForType.length) {
        return `${formatRoomType(item.roomType)} only has ${item.roomsForType.length} active room unit(s).`;
      }

      if (item.adultGuests > item.adultCapacity) {
        return `${formatRoomType(item.roomType)} can host up to ${item.adultCapacity} adult guests for ${item.roomCount} room(s).`;
      }

      if (item.childGuests > item.childCapacity) {
        return `${formatRoomType(item.roomType)} can host up to ${item.childCapacity} children for ${item.roomCount} room(s).`;
      }
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payloadRoomItems = pricedRoomItems.map((item) => ({
        roomType: item.roomType,
        roomCount: item.roomCount,
        adultGuests: item.adultGuests,
        childGuests: item.childGuests,
        assignedRoomIds: item.roomId && item.roomCount === 1 ? [item.roomId] : undefined
      }));
      const firstSingleRoomItem = pricedRoomItems.length === 1 && pricedRoomItems[0].roomCount === 1
        ? pricedRoomItems[0]
        : null;
      const payload = {
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        roomType: pricedRoomItems[0]?.roomType,
        roomId: firstSingleRoomItem?.roomId || undefined,
        roomItems: payloadRoomItems,
        numberOfGuests: totalAdults,
        numberOfChildren: totalChildren,
        numberOfRooms: totalRooms,
        totalAmount: Number(finalTotal || 0),
        overrideTotal: Boolean(form.overrideTotal),
        promoId: activeSelectedPromo?._id || undefined,
        bookingStatus: form.bookingStatus,
        paymentStatus: form.bookingStatus === "success" ? "paid" : "unpaid",
        source: selectedChannel?.key || form.source,
        sourceName: selectedChannel?.name || form.sourceName,
        adminNote: form.adminNote
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
        <Link
          to="/bookings"
          className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800"
        >
          Back to bookings
        </Link>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Guest</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input name="guestName" value={form.guestName} onChange={handleChange} required placeholder="Guest name" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="guestPhone" value={form.guestPhone} onChange={handleChange} required placeholder="Phone / WhatsApp" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="guestEmail" type="email" value={form.guestEmail} onChange={handleChange} placeholder="Email optional" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <select name="source" value={form.source} onChange={handleChange} required disabled={loading || channels.length === 0} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3">
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
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input name="checkIn" type="date" value={form.checkIn} onChange={handleChange} required className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="checkOut" type="date" value={form.checkOut} onChange={handleChange} required className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Rooms in this booking</h3>
              <p className="text-sm text-gray-500">Use multiple rows for mixed room types.</p>
            </div>
            <button
              type="button"
              onClick={addRoomItem}
              disabled={loading || rooms.length === 0}
              className="min-h-10 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Add room type
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {pricedRoomItems.map((item, index) => (
              <div key={item.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-gray-800">Room row {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeRoomItem(item.id)}
                    disabled={roomItems.length === 1}
                    className="min-h-9 rounded-md border border-red-200 px-3 py-1 text-sm text-red-700 disabled:border-gray-200 disabled:text-gray-400"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-6">
                  <select
                    value={item.roomType}
                    onChange={(event) => handleRoomItemChange(item.id, "roomType", event.target.value)}
                    disabled={loading || roomTypes.length === 0}
                    className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2"
                  >
                    {roomTypes.map((roomType) => (
                      <option key={roomType.roomType} value={roomType.roomType}>
                        {roomType.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={item.roomCount > 1 ? "" : item.roomId}
                    onChange={(event) => handleRoomItemChange(item.id, "roomId", event.target.value)}
                    disabled={loading || item.roomsForType.length === 0 || item.roomCount > 1}
                    className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2"
                  >
                    {item.roomCount > 1 ? <option value="">Auto assign {item.roomCount} rooms</option> : null}
                    {item.roomsForType.map((room) => (
                      <option key={room._id} value={room._id}>
                        {room.roomNumber} · {room.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.roomCount}
                    onChange={(event) => handleRoomItemChange(item.id, "roomCount", event.target.value)}
                    placeholder="Rooms"
                    className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  />
                  <input
                    type="number"
                    min="0"
                    value={item.adultGuests}
                    onChange={(event) => handleRoomItemChange(item.id, "adultGuests", event.target.value)}
                    placeholder="Adults"
                    className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  />
                  <input
                    type="number"
                    min="0"
                    value={item.childGuests}
                    onChange={(event) => handleRoomItemChange(item.id, "childGuests", event.target.value)}
                    placeholder="Children"
                    className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  />
                  <div className="min-h-11 rounded-md bg-white px-3 py-2 text-sm text-gray-600 md:col-span-5">
                    {item.roomCount}x {formatRoomType(item.roomType)} · capacity {item.adultCapacity} adults / {item.childCapacity} children · {currencyFormatter.format(item.subtotal || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <select name="promoId" value={selectedPromo && selectedPromoIsEligible ? form.promoId : ""} onChange={handleChange} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
              <option value="">No promo</option>
              {promos.map((promo) => {
                const eligible = isPromoEligible(promo, {
                  nights,
                  roomTypes: selectedRoomTypes,
                  totalRooms
                });
                const restriction = formatPromoRestrictions(promo);
                const reason = getPromoEligibilityMessage(promo, {
                  nights,
                  roomTypes: selectedRoomTypes,
                  totalRooms
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
            <select name="bookingStatus" value={form.bookingStatus} onChange={handleChange} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
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
            <input name="totalAmount" type="number" min="0" value={form.overrideTotal ? form.totalAmount : String(calculatedTotal || "")} onChange={handleChange} disabled={!form.overrideTotal} placeholder="Total amount" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 disabled:bg-gray-100 md:col-span-3" />
          </div>
          <div className="mt-4 grid gap-3 rounded-md bg-gray-50 p-4 text-sm md:grid-cols-4">
            <p><span className="text-gray-500">Nights:</span> <span className="font-medium">{nights}</span></p>
            <p><span className="text-gray-500">Rooms:</span> <span className="font-medium">{totalRooms}</span></p>
            <p><span className="text-gray-500">Adults:</span> <span className="font-medium">{totalAdults}</span></p>
            <p><span className="text-gray-500">Children:</span> <span className="font-medium">{totalChildren}</span></p>
            <p><span className="text-gray-500">Subtotal:</span> <span className="font-medium">{currencyFormatter.format(calculatedSubtotal)}</span></p>
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
          <textarea name="adminNote" value={form.adminNote} onChange={handleChange} placeholder="Admin note" className="mt-4 min-h-24 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        </div>

        <button type="submit" disabled={saving || loading || rooms.length === 0 || channels.length === 0} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
          {saving ? "Creating..." : "Create manual booking"}
        </button>
      </form>
    </section>
  );
}

export default CreateManualBooking;
