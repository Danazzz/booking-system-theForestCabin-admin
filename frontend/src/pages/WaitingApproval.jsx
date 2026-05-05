import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");

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

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Waiting Approval</h1>
          <p className="mt-1 text-sm text-gray-500">Review manual transfer proof before confirming bookings.</p>
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

          return (
            <article key={booking._id} className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{booking.bookingCode} · {booking.guestName}</h2>
                    <p className="text-sm text-gray-500">
                      {booking.roomId?.roomNumber} {booking.roomId?.name || booking.roomType} · {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                    </p>
                  </div>
                  <Link to={`/bookings/${booking._id}`} className="text-sm font-semibold text-gray-900 underline">
                    Detail
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <p><span className="text-gray-500">Payment:</span> <span className="font-medium">{payment?.paymentMethod || "-"}</span></p>
                  <p><span className="text-gray-500">Payment status:</span> <span className="font-medium">{payment?.paymentStatus || "-"}</span></p>
                  <p><span className="text-gray-500">Amount:</span> <span className="font-medium">{Number(booking.totalAmount || 0).toLocaleString()}</span></p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => reviewPayment(payment?._id, "approve")} disabled={!payment?._id} className="min-h-10 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                    Approve
                  </button>
                  <button type="button" onClick={() => reviewPayment(payment?._id, "reject", "invalid_payment_proof")} disabled={!payment?._id} className="min-h-10 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                    Reject proof
                  </button>
                  <button type="button" onClick={() => reviewPayment(payment?._id, "reject", "no_room_available")} disabled={!payment?._id} className="min-h-10 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:text-gray-400">
                    No room available
                  </button>
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                {payment?.proofImageUrl ? (
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
