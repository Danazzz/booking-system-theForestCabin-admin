import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");
const formatSource = (source) =>
  source === "manual_admin" ? "Manual admin" : "Website direct";

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

function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({
    adminNote: "",
    rejectionReason: "invalid_payment_proof"
  });
  const [cancelForm, setCancelForm] = useState({
    adminNote: "",
    cancellationReason: "guest_cancelled"
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  const loadBooking = async () => {
    setError("");

    try {
      const response = await api.get(`/admin/bookings/${id}`);
      setBooking(response.data.data.booking);
      setPayments(response.data.data.payments || []);

      if (response.data.data.booking?.invoiceId?._id) {
        setInvoice(response.data.data.booking.invoiceId);
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
        const response = await api.get(`/admin/bookings/${id}`);

        if (!ignore) {
          const nextBooking = response.data.data.booking;
          setBooking(nextBooking);
          setPayments(response.data.data.payments || []);
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

  const handleCancelChange = (event) => {
    setCancelForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
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
              <h2 className="font-semibold">Reservation</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-gray-500">Guest</dt><dd className="font-medium">{booking.guestName}</dd></div>
                <div><dt className="text-gray-500">Email</dt><dd className="font-medium">{booking.guestEmail}</dd></div>
                <div><dt className="text-gray-500">Phone</dt><dd className="font-medium">{booking.guestPhone}</dd></div>
                <div><dt className="text-gray-500">Room</dt><dd className="font-medium">{booking.roomId?.roomNumber} {booking.roomId?.name || booking.roomType}</dd></div>
                <div><dt className="text-gray-500">Check in</dt><dd className="font-medium">{formatDate(booking.checkIn)}</dd></div>
                <div><dt className="text-gray-500">Check out</dt><dd className="font-medium">{formatDate(booking.checkOut)}</dd></div>
                <div><dt className="text-gray-500">Adults</dt><dd className="font-medium">{booking.numberOfGuests}</dd></div>
                <div><dt className="text-gray-500">Children</dt><dd className="font-medium">{booking.numberOfChildren || 0}</dd></div>
                <div><dt className="text-gray-500">Total</dt><dd className="font-medium">{currencyFormatter.format(booking.totalAmount || 0)}</dd></div>
                {booking.promoName ? <div><dt className="text-gray-500">Promo</dt><dd className="font-medium">{booking.promoName}</dd></div> : null}
                <div><dt className="text-gray-500">Source</dt><dd className="font-medium">{formatSource(booking.source)}</dd></div>
                <div><dt className="text-gray-500">Booking status</dt><dd className="font-medium">{booking.bookingStatus}</dd></div>
                <div><dt className="text-gray-500">Payment status</dt><dd className="font-medium">{booking.paymentStatus}</dd></div>
                {booking.rejectionReason ? <div><dt className="text-gray-500">Rejection</dt><dd className="font-medium">{booking.rejectionReason}</dd></div> : null}
                {booking.cancellationReason ? <div><dt className="text-gray-500">Cancellation</dt><dd className="font-medium">{booking.cancellationReason}</dd></div> : null}
                {booking.cancelledAt ? <div><dt className="text-gray-500">Cancelled at</dt><dd className="font-medium">{formatDate(booking.cancelledAt)}</dd></div> : null}
                {booking.adminNote ? <div><dt className="text-gray-500">Admin note</dt><dd className="font-medium">{booking.adminNote}</dd></div> : null}
              </dl>
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
