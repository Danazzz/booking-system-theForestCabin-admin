import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");
const formatSource = (source) =>
  String(source || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "-";
const formatRoomType = (roomType) =>
  String(roomType || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
const getBookingRoomSummary = (booking) => {
  const assignedRooms = (booking?.roomItems || [])
    .flatMap((item) => item.assignedRooms || [])
    .filter((room) => room.roomId);

  if (assignedRooms.length) {
    return assignedRooms
      .map((room) => `${room.roomNumber} ${room.name || formatRoomType(room.roomType)}`.trim())
      .join(", ");
  }

  if (booking?.roomItems?.length) {
    return booking.roomItems
      .map((item) => `${item.roomCount || 1}x ${formatRoomType(item.roomType)}`)
      .join(", ");
  }

  return `${booking?.roomId?.roomNumber || ""} ${booking?.roomId?.name || formatRoomType(booking?.roomType)}`.trim();
};
const isSmtpLimitWarning = (value) =>
  String(value || "").includes("SMTP_DAILY_LIMIT_REACHED");

const rejectionOptions = [
  "no_room_available",
  "invalid_payment_proof",
  "payment_not_received",
  "guest_cancelled",
  "other"
];

const getPaymentDetails = (payment) => {
  const snapshot = payment?.paymentOptionSnapshot;

  if (!snapshot) {
    return null;
  }

  return {
    name: snapshot.name,
    method: snapshot.paymentMethod,
    bankName: snapshot.bankName || snapshot.providerLabel,
    accountName: snapshot.accountName,
    accountNumber: snapshot.accountNumber,
    merchantName: snapshot.merchantName,
    qrisCode: snapshot.qrisCode,
    imageUrl: snapshot.imageUrl,
    instructions: snapshot.instructions
  };
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const getIdValue = (value) => String(value?._id || value || "");

const toDateInput = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
};

const createEditRoomItem = (overrides = {}) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  roomType: "",
  roomId: "",
  assignedRoomIds: [],
  roomCount: 1,
  adultGuests: 1,
  childGuests: 0,
  ...overrides
});

const getNights = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) {
    return 0;
  }

  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const sumTopValues = (values, count) =>
  [...values]
    .sort((left, right) => Number(right || 0) - Number(left || 0))
    .slice(0, count)
    .reduce((total, value) => total + Number(value || 0), 0);

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

const buildEditRoomItems = (booking) => {
  const sourceItems = booking?.roomItems?.length
    ? booking.roomItems
    : [
        {
          roomType: booking?.roomType || "",
          roomCount: booking?.numberOfRooms || 1,
          adultGuests: booking?.numberOfGuests || 1,
          childGuests: booking?.numberOfChildren || 0,
          assignedRooms: booking?.roomId ? [booking.roomId] : []
        }
      ];

  return sourceItems.map((item) => {
    const assignedRoomIds = (item.assignedRooms || [])
      .map((room) => getIdValue(room.roomId || room._id))
      .filter(Boolean);

    return createEditRoomItem({
      roomType: item.roomType || "",
      roomId: assignedRoomIds.length === 1 ? assignedRoomIds[0] : "",
      assignedRoomIds,
      roomCount: Number(item.roomCount || assignedRoomIds.length || 1),
      adultGuests: Number(item.adultGuests || 0),
      childGuests: Number(item.childGuests || 0)
    });
  });
};

function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({
    adminNote: "",
    rejectionReason: "invalid_payment_proof"
  });
  const [emailForm, setEmailForm] = useState({
    guestEmail: ""
  });
  const [cancelForm, setCancelForm] = useState({
    adminNote: "",
    cancellationReason: "guest_cancelled"
  });
  const [rooms, setRooms] = useState([]);
  const [channels, setChannels] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    checkIn: "",
    checkOut: "",
    bookingStatus: "pending_payment",
    paymentStatus: "unpaid",
    source: "",
    sourceName: "",
    totalAmount: "",
    adminNote: ""
  });
  const [editRoomItems, setEditRoomItems] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const roomTypeProfiles = useMemo(() => buildRoomTypeProfiles(rooms), [rooms]);
  const roomTypes = useMemo(
    () =>
      Array.from(roomTypeProfiles.values()).map((profile) => ({
        roomType: profile.roomType,
        label: profile.label
      })),
    [roomTypeProfiles]
  );
  const pricedEditRoomItems = useMemo(
    () =>
      editRoomItems.map((item) => {
        const profile = roomTypeProfiles.get(item.roomType) || null;
        const roomsForType = profile?.rooms || [];
        const roomCount = Math.max(1, Number(item.roomCount || 1));
        const assignedRoomIds = Array.isArray(item.assignedRoomIds)
          ? item.assignedRoomIds.filter(Boolean)
          : [];
        const selectedRooms = roomsForType.filter((room) => assignedRoomIds.includes(room._id));
        const roomId = roomCount === 1
          ? item.roomId || assignedRoomIds[0] || ""
          : "";
        const selectedRoom = roomsForType.find((room) => room._id === roomId) || null;
        const capacityRooms = selectedRooms.length ? selectedRooms : roomsForType;
        const adultCapacity = selectedRooms.length
          ? selectedRooms.reduce((total, room) => total + Number(room.capacity || 0), 0)
          : sumTopValues(capacityRooms.map((room) => room.capacity), roomCount);
        const childCapacity = selectedRooms.length
          ? selectedRooms.reduce((total, room) => total + Number(room.childCapacity || 0), 0)
          : sumTopValues(capacityRooms.map((room) => room.childCapacity), roomCount);

        return {
          ...item,
          profile,
          roomsForType,
          roomCount,
          roomId,
          selectedRoom,
          selectedRooms,
          assignedRoomIds,
          adultGuests: Math.max(0, Number(item.adultGuests || 0)),
          childGuests: Math.max(0, Number(item.childGuests || 0)),
          adultCapacity,
          childCapacity
        };
      }),
    [editRoomItems, roomTypeProfiles]
  );
  const editNights = getNights(editForm.checkIn, editForm.checkOut);
  const editTotalRooms = pricedEditRoomItems.reduce((total, item) => total + item.roomCount, 0);
  const editTotalAdults = pricedEditRoomItems.reduce((total, item) => total + item.adultGuests, 0);
  const editTotalChildren = pricedEditRoomItems.reduce((total, item) => total + item.childGuests, 0);
  const latestPayment = payments[0] || booking?.paymentId || null;
  const paymentDetails = getPaymentDetails(latestPayment);
  const canReviewAvailability =
    booking?.bookingStatus === "waiting_availability_approval";
  const canReviewPayment =
    booking &&
    !["success", "cancelled", "rejected"].includes(booking.bookingStatus) &&
    latestPayment;
  const canCancelBooking =
    booking && !["cancelled", "rejected"].includes(booking.bookingStatus);
  const canSendPaymentReminder = booking?.bookingStatus === "pending_payment";
  const canResendBookingEmail =
    booking?.bookingStatus === "pending_payment" ||
    (booking?.bookingStatus === "rejected" &&
      booking?.rejectionReason === "no_room_available");

  const syncEditState = (nextBooking) => {
    setEditForm({
      guestName: nextBooking?.guestName || "",
      guestEmail: nextBooking?.guestEmail || "",
      guestPhone: nextBooking?.guestPhone || "",
      checkIn: toDateInput(nextBooking?.checkIn),
      checkOut: toDateInput(nextBooking?.checkOut),
      bookingStatus: nextBooking?.bookingStatus || "pending_payment",
      paymentStatus: nextBooking?.paymentStatus || "unpaid",
      source: nextBooking?.source || "",
      sourceName: nextBooking?.sourceName || "",
      totalAmount: String(nextBooking?.totalAmount || 0),
      adminNote: nextBooking?.adminNote || ""
    });
    setEditRoomItems(buildEditRoomItems(nextBooking));
  };

  const loadBooking = async () => {
    setError("");

    try {
      const response = await api.get(`/admin/bookings/${id}`);
      const nextBooking = response.data.data.booking;

      setBooking(nextBooking);
      syncEditState(nextBooking);
      setEmailForm({ guestEmail: nextBooking?.guestEmail || "" });
      setPayments(response.data.data.payments || []);

      if (nextBooking?.invoiceId?._id) {
        setInvoice(nextBooking.invoiceId);
      } else {
        setInvoice(null);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load booking detail");
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialBooking = async () => {
      try {
        const [bookingResponse, roomsResponse, channelsResponse] = await Promise.all([
          api.get(`/admin/bookings/${id}`),
          api.get("/rooms", { params: { status: "active" } }),
          api.get("/channels")
        ]);

        if (!ignore) {
          const nextBooking = bookingResponse.data.data.booking;
          setBooking(nextBooking);
          syncEditState(nextBooking);
          setRooms(roomsResponse.data.data || []);
          setChannels(channelsResponse.data.data || []);
          setEmailForm({ guestEmail: nextBooking?.guestEmail || "" });
          setPayments(bookingResponse.data.data.payments || []);
          setInvoice(nextBooking?.invoiceId?._id ? nextBooking.invoiceId : null);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || "Failed to load booking detail");
        }
      }
    };

    loadInitialBooking();

    return () => {
      ignore = true;
    };
  }, [id]);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleEmailChange = (event) => {
    setEmailForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleCancelChange = (event) => {
    setCancelForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((current) => {
      const next = {
        ...current,
        [name]: value
      };

      if (name === "bookingStatus" && value === "success") {
        next.paymentStatus = "paid";
      }

      if (name === "bookingStatus" && value === "pending_payment") {
        next.paymentStatus = "unpaid";
      }

      if (name === "bookingStatus" && value === "waiting_availability_approval") {
        next.paymentStatus = "unpaid";
      }

      if (name === "bookingStatus" && value === "waiting_admin_approval") {
        next.paymentStatus = "pending";
      }

      if (name === "source") {
        const channel = channels.find((item) => item.key === value);
        next.sourceName = channel?.name || current.sourceName;
      }

      return next;
    });
  };

  const handleEditRoomItemChange = (itemId, field, value) => {
    setEditRoomItems((currentItems) =>
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
          next.assignedRoomIds = firstRoom?._id ? [firstRoom._id] : [];
        }

        if (field === "roomId") {
          next.assignedRoomIds = value ? [value] : [];
        }

        if (field === "roomCount") {
          const nextCount = Math.max(1, Number(value || 1));

          if (nextCount === 1) {
            next.roomId = next.roomId || next.assignedRoomIds[0] || "";
            next.assignedRoomIds = next.roomId ? [next.roomId] : [];
          } else {
            next.roomId = "";
            next.assignedRoomIds = next.assignedRoomIds.slice(0, nextCount);
          }
        }

        return next;
      })
    );
  };

  const toggleEditAssignedRoom = (itemId, roomId) => {
    setEditRoomItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const selected = Array.isArray(item.assignedRoomIds)
          ? item.assignedRoomIds
          : [];
        const selectedSet = new Set(selected);

        if (selectedSet.has(roomId)) {
          selectedSet.delete(roomId);
        } else if (selectedSet.size < Number(item.roomCount || 1)) {
          selectedSet.add(roomId);
        }

        return {
          ...item,
          roomId: "",
          assignedRoomIds: Array.from(selectedSet)
        };
      })
    );
  };

  const addEditRoomItem = () => {
    const firstRoom = rooms[0] || null;

    setEditRoomItems((currentItems) => [
      ...currentItems,
      createEditRoomItem({
        roomType: firstRoom?.roomType || "",
        roomId: firstRoom?._id || "",
        assignedRoomIds: firstRoom?._id ? [firstRoom._id] : []
      })
    ]);
  };

  const removeEditRoomItem = (itemId) => {
    setEditRoomItems((currentItems) =>
      currentItems.length === 1
        ? currentItems
        : currentItems.filter((item) => item.id !== itemId)
    );
  };

  const validateEditForm = () => {
    if (editNights <= 0) {
      return "Check-out must be later than check-in.";
    }

    if (!pricedEditRoomItems.length) {
      return "Add at least one room row.";
    }

    if (editTotalAdults <= 0) {
      return "Enter at least one adult guest.";
    }

    for (const item of pricedEditRoomItems) {
      if (!item.roomType || !item.profile) {
        return "Select an active room type for every room row.";
      }

      if (item.roomCount > item.roomsForType.length) {
        return `${formatRoomType(item.roomType)} only has ${item.roomsForType.length} active room unit(s).`;
      }

      if (item.assignedRoomIds.length > 0 && item.assignedRoomIds.length !== item.roomCount) {
        return `Select exactly ${item.roomCount} room(s) for ${formatRoomType(item.roomType)}, or clear all selections for auto assignment.`;
      }

      if (item.adultGuests > item.adultCapacity) {
        return `${formatRoomType(item.roomType)} can host up to ${item.adultCapacity} adult guests for the selected room(s).`;
      }

      if (item.childGuests > item.childCapacity) {
        return `${formatRoomType(item.roomType)} can host up to ${item.childCapacity} children for the selected room(s).`;
      }
    }

    return "";
  };

  const saveEditedBooking = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateEditForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSavingEdit(true);

    try {
      const payloadRoomItems = pricedEditRoomItems.map((item) => {
        const assignedRoomIds = item.roomCount === 1
          ? item.roomId ? [item.roomId] : item.assignedRoomIds
          : item.assignedRoomIds;

        return {
          roomType: item.roomType,
          roomCount: item.roomCount,
          adultGuests: item.adultGuests,
          childGuests: item.childGuests,
          assignedRoomIds: assignedRoomIds.length ? assignedRoomIds : undefined
        };
      });
      const firstSingleRoomItem = pricedEditRoomItems.length === 1 && pricedEditRoomItems[0].roomCount === 1
        ? pricedEditRoomItems[0]
        : null;
      const response = await api.patch(`/admin/bookings/${booking._id}`, {
        guestName: editForm.guestName,
        guestEmail: editForm.guestEmail,
        guestPhone: editForm.guestPhone,
        checkIn: editForm.checkIn,
        checkOut: editForm.checkOut,
        roomType: pricedEditRoomItems[0]?.roomType,
        roomId: firstSingleRoomItem?.roomId || undefined,
        roomItems: payloadRoomItems,
        numberOfGuests: editTotalAdults,
        numberOfChildren: editTotalChildren,
        numberOfRooms: editTotalRooms,
        totalAmount: Number(editForm.totalAmount || 0),
        overrideTotal: true,
        bookingStatus: editForm.bookingStatus,
        paymentStatus: editForm.paymentStatus,
        source: editForm.source,
        sourceName: editForm.sourceName,
        adminNote: editForm.adminNote
      });
      const nextBooking = response.data.data.booking;

      setBooking(nextBooking);
      syncEditState(nextBooking);
      setPayments(response.data.data.payments || []);
      setInvoice(nextBooking?.invoiceId?._id ? nextBooking.invoiceId : null);
      setEditing(false);
      setMessage("Booking updated successfully.");
      await loadBooking();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update booking"));
    } finally {
      setSavingEdit(false);
    }
  };

  const runPaymentAction = async (action) => {
    if (!latestPayment?._id) {
      setError("No payment record found for this booking.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload =
        action === "reject"
          ? {
              adminNote: form.adminNote,
              rejectionReason: form.rejectionReason
            }
          : { adminNote: form.adminNote };

      const response = await api.patch(`/admin/payments/${latestPayment._id}/${action}`, payload);
      setBooking(response.data.data.booking);
      setPayments(response.data.data.payments || []);
      setMessage(action === "approve" ? "Payment approved and booking confirmed." : "Payment rejected.");
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} payment`);
    } finally {
      setLoading(false);
    }
  };

  const runAvailabilityAction = async (action) => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(`/admin/bookings/${booking._id}/availability/${action}`, {
        rejectionReason: "no_room_available",
        adminNote:
          action === "approve"
            ? form.adminNote || "Room availability approved. Guest can continue payment."
            : form.adminNote || "Requested dates are not available."
      });
      const nextBooking = response.data.data.booking;

      setBooking(nextBooking);
      setMessage(
        action === "approve"
          ? "Availability approved. Guest can continue payment."
          : "Booking rejected and guest will be notified."
      );
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} availability`);
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(`/admin/bookings/${booking._id}/cancel`, cancelForm);
      const nextBooking = response.data.data.booking;

      setBooking(nextBooking);
      setPayments(response.data.data.payments || []);
      setInvoice(nextBooking?.invoiceId?._id ? nextBooking.invoiceId : null);
      setMessage("Booking cancelled. Calendar event and invoice were updated.");
      await loadBooking();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel booking");
    } finally {
      setLoading(false);
    }
  };

  const sendPaymentReminder = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(`/admin/bookings/${booking._id}/payment-reminder`);
      const result = response.data.data;
      const suffix = result?.sent ? " Email sent." : ` ${result?.reason || "Email was not sent."}`;

      setMessage(`Payment reminder processed.${suffix}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send payment reminder");
    } finally {
      setLoading(false);
    }
  };

  const updateGuestEmail = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(`/admin/bookings/${booking._id}/guest-email`, emailForm);
      const nextBooking = response.data.data;

      setBooking(nextBooking);
      setEmailForm({ guestEmail: nextBooking?.guestEmail || "" });
      setMessage("Guest email updated. You can resend the booking email now.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update guest email");
    } finally {
      setLoading(false);
    }
  };

  const resendBookingEmail = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post(`/admin/bookings/${booking._id}/email/resend`);
      const result = response.data.data.email;
      const nextBooking = response.data.data.booking;
      const suffix = result?.sent ? " Email sent." : ` ${result?.reason || "Email was not sent."}`;

      setBooking(nextBooking);
      setEmailForm({ guestEmail: nextBooking?.guestEmail || "" });
      setMessage(`Booking email resend processed.${suffix}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend booking email");
    } finally {
      setLoading(false);
    }
  };

  if (!booking && !error) {
    return <p className="text-sm text-gray-500">Loading booking detail...</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Booking Detail</h1>
          <p className="mt-1 text-sm text-gray-500">{booking?.bookingCode || id}</p>
        </div>
        <Link to="/bookings" className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">
          Back to bookings
        </Link>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      {booking ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-semibold">Reservation</h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!editing) {
                      syncEditState(booking);
                    }

                    setEditing((current) => !current);
                  }}
                  disabled={booking.bookingStatus === "cancelled"}
                  className="min-h-10 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:text-gray-400"
                >
                  {editing ? "Close edit" : "Edit booking"}
                </button>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Guest</dt><dd className="font-medium">{booking.guestName}</dd></div>
                <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{booking.guestEmail}</dd></div>
                <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{booking.guestPhone}</dd></div>
                <div><dt className="text-gray-500">Room</dt><dd className="font-medium">{getBookingRoomSummary(booking)}</dd></div>
                <div><dt className="text-gray-500">Check in</dt><dd className="font-medium">{formatDate(booking.checkIn)}</dd></div>
                <div><dt className="text-gray-500">Check out</dt><dd className="font-medium">{formatDate(booking.checkOut)}</dd></div>
                <div><dt className="text-gray-500">Adults</dt><dd className="font-medium">{booking.numberOfGuests}</dd></div>
                <div><dt className="text-gray-500">Children</dt><dd className="font-medium">{booking.numberOfChildren || 0}</dd></div>
                <div><dt className="text-gray-500">Room count</dt><dd className="font-medium">{booking.numberOfRooms || 1}</dd></div>
                <div><dt className="text-gray-500">Total</dt><dd className="font-medium">{currencyFormatter.format(booking.totalAmount || 0)}</dd></div>
                {booking.promoName ? <div><dt className="text-gray-500">Promo</dt><dd className="font-medium">{booking.promoName}</dd></div> : null}
                <div><dt className="text-gray-500">Source</dt><dd className="font-medium">{booking.sourceName || formatSource(booking.source)}</dd></div>
                <div><dt className="text-gray-500">Booking status</dt><dd className="font-medium">{booking.bookingStatus}</dd></div>
                <div><dt className="text-gray-500">Payment status</dt><dd className="font-medium">{booking.paymentStatus}</dd></div>
                {booking.paymentDueAt ? <div><dt className="text-gray-500">Payment deadline</dt><dd className="font-medium">{formatDateTime(booking.paymentDueAt)}</dd></div> : null}
                {booking.rejectionReason ? <div><dt className="text-gray-500">Rejection</dt><dd className="font-medium">{booking.rejectionReason}</dd></div> : null}
                {booking.cancellationReason ? <div><dt className="text-gray-500">Cancellation</dt><dd className="font-medium">{booking.cancellationReason}</dd></div> : null}
                {booking.cancelledAt ? <div><dt className="text-gray-500">Cancelled at</dt><dd className="font-medium">{formatDate(booking.cancelledAt)}</dd></div> : null}
                {booking.adminNote ? <div><dt className="text-gray-500">Admin note</dt><dd className="font-medium">{booking.adminNote}</dd></div> : null}
              </dl>
              {booking.roomItems?.length ? (
                <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="font-semibold text-gray-900">Room breakdown</p>
                  <div className="mt-2 space-y-2">
                    {booking.roomItems.map((item, index) => (
                      <div key={`${item.roomType}-${index}`} className="rounded-md bg-white p-3">
                        <p className="font-medium">
                          {item.roomCount || 1}x {formatRoomType(item.roomType)} · {item.adultGuests || 0} adults · {item.childGuests || 0} children
                        </p>
                        {item.assignedRooms?.length ? (
                          <p className="mt-1 text-gray-600">
                            Rooms: {item.assignedRooms.map((room) => room.roomNumber).join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-amber-700">Rooms will be assigned when availability is approved.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {editing ? (
                <form onSubmit={saveEditedBooking} className="mt-4 space-y-4 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div>
                    <p className="font-semibold text-gray-900">Edit booking</p>
                    <p className="mt-1 text-sm text-gray-600">
                      Changes to successful bookings will refresh calendar blocks and invoice totals.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <input name="guestName" value={editForm.guestName} onChange={handleEditChange} required placeholder="Guest name" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                    <input name="guestPhone" value={editForm.guestPhone} onChange={handleEditChange} required placeholder="Phone / WhatsApp" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                    <input name="guestEmail" type="email" value={editForm.guestEmail} onChange={handleEditChange} placeholder="Guest email" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                    <input name="checkIn" type="date" value={editForm.checkIn} onChange={handleEditChange} required className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                    <input name="checkOut" type="date" value={editForm.checkOut} onChange={handleEditChange} required className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                    <select name="source" value={editForm.source} onChange={handleEditChange} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
                      {channels.length ? (
                        channels.map((channel) => (
                          <option key={channel._id} value={channel.key}>
                            {channel.name}
                          </option>
                        ))
                      ) : (
                        <option value={editForm.source}>{editForm.sourceName || formatSource(editForm.source)}</option>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Rooms</p>
                      <p className="text-sm text-gray-500">Use multiple rows for mixed room types.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addEditRoomItem}
                      disabled={rooms.length === 0}
                      className="min-h-10 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      Add room row
                    </button>
                  </div>

                  <div className="space-y-3">
                    {pricedEditRoomItems.map((item, index) => (
                      <div key={item.id} className="rounded-md border border-gray-200 bg-white p-3">
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-gray-800">Room row {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeEditRoomItem(item.id)}
                            disabled={editRoomItems.length === 1}
                            className="min-h-9 rounded-md border border-red-200 px-3 py-1 text-sm text-red-700 disabled:border-gray-200 disabled:text-gray-400"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-6">
                          <select
                            value={item.roomType}
                            onChange={(event) => handleEditRoomItemChange(item.id, "roomType", event.target.value)}
                            disabled={roomTypes.length === 0}
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
                            onChange={(event) => handleEditRoomItemChange(item.id, "roomId", event.target.value)}
                            disabled={item.roomsForType.length === 0 || item.roomCount > 1}
                            className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2"
                          >
                            {item.roomCount > 1 ? <option value="">Choose rooms below or auto assign</option> : null}
                            {item.roomsForType.map((room) => (
                              <option key={room._id} value={room._id}>
                                {room.roomNumber} · {room.name}
                              </option>
                            ))}
                          </select>
                          <input type="number" min="1" value={item.roomCount} onChange={(event) => handleEditRoomItemChange(item.id, "roomCount", event.target.value)} placeholder="Rooms" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                          <input type="number" min="0" value={item.adultGuests} onChange={(event) => handleEditRoomItemChange(item.id, "adultGuests", event.target.value)} placeholder="Adults" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                          <input type="number" min="0" value={item.childGuests} onChange={(event) => handleEditRoomItemChange(item.id, "childGuests", event.target.value)} placeholder="Children" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                          <div className="min-h-11 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 md:col-span-5">
                            {item.roomCount}x {formatRoomType(item.roomType)} · capacity {item.adultCapacity} adults / {item.childCapacity} children
                          </div>
                        </div>
                        {item.roomCount > 1 ? (
                          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                            <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-medium text-gray-800">Specific rooms</p>
                              <p className="text-gray-500">{item.assignedRoomIds.length}/{item.roomCount} selected</p>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {item.roomsForType.map((room) => {
                                const checked = item.assignedRoomIds.includes(room._id);
                                const disabled = !checked && item.assignedRoomIds.length >= item.roomCount;

                                return (
                                  <label key={room._id} className="flex min-h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabled}
                                      onChange={() => toggleEditAssignedRoom(item.id, room._id)}
                                    />
                                    <span>{room.roomNumber} · {room.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                              Leave all unchecked to let the system auto-assign available rooms.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <select name="bookingStatus" value={editForm.bookingStatus} onChange={handleEditChange} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
                      <option value="waiting_availability_approval">Waiting availability approval</option>
                      <option value="pending_payment">Pending payment</option>
                      <option value="waiting_admin_approval">Waiting payment approval</option>
                      <option value="success">Success</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <select name="paymentStatus" value={editForm.paymentStatus} onChange={handleEditChange} className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
                      <option value="unpaid">Unpaid</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="rejected">Rejected</option>
                      <option value="refund_required">Refund required</option>
                    </select>
                    <input name="totalAmount" type="number" min="0" value={editForm.totalAmount} onChange={handleEditChange} placeholder="Total amount" className="min-h-11 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                  </div>

                  <div className="grid gap-3 rounded-md bg-white p-3 text-sm md:grid-cols-4">
                    <p><span className="text-gray-500">Nights:</span> <span className="font-medium">{editNights}</span></p>
                    <p><span className="text-gray-500">Rooms:</span> <span className="font-medium">{editTotalRooms}</span></p>
                    <p><span className="text-gray-500">Adults:</span> <span className="font-medium">{editTotalAdults}</span></p>
                    <p><span className="text-gray-500">Children:</span> <span className="font-medium">{editTotalChildren}</span></p>
                  </div>

                  <textarea name="adminNote" value={editForm.adminNote} onChange={handleEditChange} placeholder="Admin note" className="min-h-24 w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="submit" disabled={savingEdit || loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                      {savingEdit ? "Saving..." : "Save booking changes"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800">
                      Cancel edit
                    </button>
                  </div>
                </form>
              ) : null}
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Invoice</h2>
              {invoice ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-gray-500">Number</dt><dd className="font-medium">{invoice.invoiceNumber}</dd></div>
                  <div><dt className="text-gray-500">Status</dt><dd className="font-medium">{invoice.invoiceStatus}</dd></div>
                  <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{invoice.emailStatus || "pending"}</dd></div>
                  <div><dt className="text-gray-500">Issued</dt><dd className="font-medium">{formatDate(invoice.issuedAt)}</dd></div>
                  {invoice.emailError ? <div><dt className="text-gray-500">Email error</dt><dd className="font-medium text-red-700">{invoice.emailError}</dd></div> : null}
                  {isSmtpLimitWarning(invoice.emailError) ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                      SMTP daily limit may have been reached. Send the invoice manually if the guest needs it now.
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-gray-500">Invoice is generated after approval.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Payment Proof</h2>
              {latestPayment ? (
                <div className="mt-4 space-y-3 text-sm">
                  <p><span className="text-gray-500">Method:</span> <span className="font-medium">{latestPayment.paymentMethod}</span></p>
                  <p><span className="text-gray-500">Status:</span> <span className="font-medium">{latestPayment.paymentStatus}</span></p>
                  <p><span className="text-gray-500">Reference:</span> <span className="font-medium">{latestPayment.transactionReference || "-"}</span></p>
                  {paymentDetails ? (
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <p className="font-semibold text-gray-900">{paymentDetails.name}</p>
                      {paymentDetails.accountNumber ? (
                        <p className="mt-2">
                          <span className="text-gray-500">Account/VA:</span>{" "}
                          <span className="font-medium">{paymentDetails.accountNumber}</span>
                        </p>
                      ) : null}
                      {paymentDetails.bankName ? (
                        <p>
                          <span className="text-gray-500">Bank:</span>{" "}
                          <span className="font-medium">{paymentDetails.bankName}</span>
                        </p>
                      ) : null}
                      {paymentDetails.accountName ? (
                        <p>
                          <span className="text-gray-500">Account name:</span>{" "}
                          <span className="font-medium">{paymentDetails.accountName}</span>
                        </p>
                      ) : null}
                      {paymentDetails.merchantName ? (
                        <p>
                          <span className="text-gray-500">Merchant:</span>{" "}
                          <span className="font-medium">{paymentDetails.merchantName}</span>
                        </p>
                      ) : null}
                      {paymentDetails.qrisCode ? (
                        <p className="break-all">
                          <span className="text-gray-500">QRIS reference:</span>{" "}
                          <span className="font-medium">{paymentDetails.qrisCode}</span>
                        </p>
                      ) : null}
                      {paymentDetails.imageUrl ? (
                        <a href={paymentDetails.imageUrl} target="_blank" rel="noreferrer" className="mt-3 block">
                          <img src={paymentDetails.imageUrl} alt="Payment method" className="max-h-60 rounded-md border border-gray-200 bg-white object-contain" />
                        </a>
                      ) : null}
                      {paymentDetails.instructions ? (
                        <p className="mt-3 whitespace-pre-line text-gray-600">{paymentDetails.instructions}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {latestPayment.proofImageUrl ? (
                    <a href={latestPayment.proofImageUrl} target="_blank" rel="noreferrer" className="block">
                      <img src={latestPayment.proofImageUrl} alt="Payment proof" className="max-h-[520px] rounded-md border border-gray-200 object-contain" />
                    </a>
                  ) : (
                    <p className="text-gray-500">No proof uploaded yet.</p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">No payment has been created.</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Guest Email</h2>
                <input name="guestEmail" type="email" value={emailForm.guestEmail} onChange={handleEmailChange} placeholder="Guest email" className="mt-4 min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={updateGuestEmail} disabled={loading} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:text-gray-400">
                    Update email
                  </button>
                  <button type="button" onClick={resendBookingEmail} disabled={loading || !emailForm.guestEmail || !canResendBookingEmail} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                    Resend booking email
                  </button>
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div><dt className="text-gray-500">Delivery status</dt><dd className="font-medium">{booking.emailDeliveryStatus || "pending"}</dd></div>
                  {booking.emailDeliveryType ? <div><dt className="text-gray-500">Email type</dt><dd className="font-medium">{booking.emailDeliveryType}</dd></div> : null}
                  {booking.emailDeliveryRecipient ? <div><dt className="text-gray-500">Last recipient</dt><dd className="font-medium">{booking.emailDeliveryRecipient}</dd></div> : null}
                  {booking.emailLastAttemptedAt ? <div><dt className="text-gray-500">Last attempted</dt><dd className="font-medium">{formatDateTime(booking.emailLastAttemptedAt)}</dd></div> : null}
                  {booking.emailLastSentAt ? <div><dt className="text-gray-500">Last sent</dt><dd className="font-medium">{formatDateTime(booking.emailLastSentAt)}</dd></div> : null}
                  {booking.emailDeliveryError ? <div><dt className="text-gray-500">Email error</dt><dd className="font-medium text-red-700">{booking.emailDeliveryError}</dd></div> : null}
                </dl>
                {isSmtpLimitWarning(booking.emailDeliveryError) ? (
                  <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    SMTP daily limit may have been reached. Contact this guest manually via WhatsApp, then retry email after the quota resets.
                  </p>
                ) : null}
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Availability Review</h2>
                {canReviewAvailability ? (
                  <>
                    <p className="mt-3 text-sm text-gray-600">
                      Approve only if a room is available for the requested dates. Payment opens after approval.
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => runAvailabilityAction("approve")} disabled={loading} className="min-h-11 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                        Approve availability
                      </button>
                      <button type="button" onClick={() => runAvailabilityAction("reject")} disabled={loading} className="min-h-11 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:text-gray-400">
                        No room available
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    Availability review is only needed for new guest requests.
                  </p>
                )}
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Review Payment</h2>
                <textarea name="adminNote" value={form.adminNote} onChange={handleChange} placeholder="Admin note" className="mt-4 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
                <select name="rejectionReason" value={form.rejectionReason} onChange={handleChange} className="mt-3 min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
                  {rejectionOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => runPaymentAction("approve")} disabled={loading || !canReviewPayment} className="min-h-11 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                    Approve
                  </button>
                  <button type="button" onClick={() => runPaymentAction("reject")} disabled={loading || !canReviewPayment} className="min-h-11 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                    Reject
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold">Payment Reminder</h2>
                <p className="mt-3 text-sm text-gray-600">
                  Send a reminder email when availability is approved but the guest has not paid yet.
                </p>
                <button type="button" onClick={sendPaymentReminder} disabled={loading || !canSendPaymentReminder} className="mt-4 min-h-11 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:text-gray-400">
                  Send payment reminder
                </button>
              </div>

              <div className="rounded-md border border-red-200 bg-white p-4 shadow-sm">
                <h2 className="font-semibold text-red-900">Cancel Booking</h2>
                <select name="cancellationReason" value={cancelForm.cancellationReason} onChange={handleCancelChange} className="mt-4 min-h-11 w-full rounded-md border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-700">
                  <option value="guest_cancelled">guest_cancelled</option>
                  <option value="no_room_available">no_room_available</option>
                  <option value="payment_not_received">payment_not_received</option>
                  <option value="other">other</option>
                </select>
                <textarea name="adminNote" value={cancelForm.adminNote} onChange={handleCancelChange} placeholder="Cancellation note" className="mt-3 min-h-24 w-full rounded-md border border-red-200 px-3 py-2 text-sm outline-none focus:border-red-700" />
                <button type="button" onClick={cancelBooking} disabled={loading || !canCancelBooking} className="mt-4 min-h-11 w-full rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                  Cancel booking
                </button>
                {booking.bookingStatus === "success" && booking.paymentStatus === "paid" ? (
                  <p className="mt-3 text-sm text-red-700">Paid bookings will be marked as refund_required.</p>
                ) : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default BookingDetail;
