import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "-");
const formatRoomType = (roomType) =>
  String(roomType || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
const getBookingRoomSummary = (booking) => {
  const assignedRooms = (booking.roomItems || [])
    .flatMap((item) => item.assignedRooms || [])
    .filter((room) => room.roomId);

  if (assignedRooms.length) {
    return assignedRooms.map((room) => room.roomNumber).join(", ");
  }

  if (booking.roomItems?.length) {
    return booking.roomItems
      .map((item) => `${item.roomCount || 1}x ${formatRoomType(item.roomType)}`)
      .join(", ");
  }

  return `${booking.roomId?.roomNumber || "Room not assigned"} ${booking.roomId?.name || formatRoomType(booking.roomType)}`.trim();
};
const statusLabels = {
  waiting_availability_approval: "Waiting availability approval",
  pending_payment: "Pending payment",
  waiting_admin_approval: "Waiting payment proof approval"
};

function WaitingApproval() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadBookings = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/bookings/waiting-approval");
      setBookings(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load waiting approval bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialBookings = async () => {
      try {
        const response = await api.get("/admin/bookings/waiting-approval");

        if (!ignore) {
          setBookings(response.data.data || []);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.message || "Failed to load waiting approval bookings");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitialBookings();

    return () => {
      ignore = true;
    };
  }, []);

  const reviewPayment = async (paymentId, action, rejectionReason = "invalid_payment_proof") => {
    setError("");
    setMessage("");

    try {
      await api.patch(`/admin/payments/${paymentId}/${action}`, {
        rejectionReason,
        adminNote: action === "reject" ? rejectionReason : "Payment proof approved"
      });
      setMessage(action === "approve" ? "Booking approved." : "Booking rejected.");
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} payment`);
    }
  };

  const reviewAvailability = async (bookingId, action) => {
    setError("");
    setMessage("");

    try {
      await api.patch(`/admin/bookings/${bookingId}/availability/${action}`, {
        rejectionReason: "no_room_available",
        adminNote:
          action === "approve"
            ? "Room availability approved. Guest can continue payment."
            : "Requested dates are not available."
      });
      setMessage(
        action === "approve"
          ? "Availability approved. Guest can continue payment."
          : "Booking rejected and guest will be notified."
      );
      await loadBookings();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} availability`);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Waiting Approval</h1>
          <p className="mt-1 text-sm text-gray-500">Review availability requests first, then payment proof after guests pay.</p>
        </div>
        <button type="button" onClick={loadBookings} disabled={loading} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:text-gray-400">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <div className="grid gap-4">
        {bookings.map((booking) => {
          const payment = booking.latestPayment;
          const waitingAvailability =
            booking.bookingStatus === "waiting_availability_approval";

          return (
            <article key={booking._id} className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{booking.bookingCode} · {booking.guestName}</h2>
                    <p className="text-sm text-gray-500">
                      {getBookingRoomSummary(booking)} · {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                    </p>
                  </div>
                  <Link to={`/bookings/${booking._id}`} className="text-sm font-semibold text-gray-900 underline">
                    Detail
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <p><span className="text-gray-500">Status:</span> <span className="font-medium">{statusLabels[booking.bookingStatus] || booking.bookingStatus}</span></p>
                  <p><span className="text-gray-500">Payment:</span> <span className="font-medium">{payment?.paymentMethod || "-"}</span></p>
                  <p><span className="text-gray-500">Payment status:</span> <span className="font-medium">{payment?.paymentStatus || "-"}</span></p>
                  <p><span className="text-gray-500">Amount:</span> <span className="font-medium">{Number(booking.totalAmount || 0).toLocaleString()}</span></p>
                  {booking.paymentDueAt ? <p><span className="text-gray-500">Payment deadline:</span> <span className="font-medium">{formatDateTime(booking.paymentDueAt)}</span></p> : null}
                </div>
                {waitingAvailability ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => reviewAvailability(booking._id, "approve")} className="min-h-10 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white">
                      Approve availability
                    </button>
                    <button type="button" onClick={() => reviewAvailability(booking._id, "reject")} className="min-h-10 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">
                      No room available
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => reviewPayment(payment?._id, "approve")} disabled={!payment?._id} className="min-h-10 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                      Approve payment
                    </button>
                    <button type="button" onClick={() => reviewPayment(payment?._id, "reject", "invalid_payment_proof")} disabled={!payment?._id} className="min-h-10 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                      Reject proof
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                {waitingAvailability ? (
                  <div className="flex h-44 items-center justify-center rounded bg-white px-3 text-center text-sm text-gray-500">
                    Payment proof will appear after availability is approved and guest pays.
                  </div>
                ) : payment?.proofImageUrl ? (
                  <a href={payment.proofImageUrl} target="_blank" rel="noreferrer">
                    <img src={payment.proofImageUrl} alt="Payment proof" className="h-44 w-full rounded object-cover" />
                  </a>
                ) : (
                  <div className="flex h-44 items-center justify-center text-sm text-gray-500">No proof</div>
                )}
              </div>
            </article>
          );
        })}
        {!bookings.length ? (
          <p className="rounded-md border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
            {loading ? "Loading bookings..." : "No bookings waiting for approval."}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default WaitingApproval;
