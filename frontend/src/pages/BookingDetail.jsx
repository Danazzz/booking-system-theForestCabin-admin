import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : "-");

const rejectionOptions = [
  "no_room_available",
  "invalid_payment_proof",
  "payment_not_received",
  "guest_cancelled",
  "other"
];

function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [form, setForm] = useState({
    adminNote: "",
    rejectionReason: "invalid_payment_proof"
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const latestPayment = payments[0] || booking?.paymentId || null;

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
    loadBooking();
  }, [id]);

  const handleChange = (event) => {
    setForm((current) => ({
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
                <div><dt className="text-gray-500">Guests</dt><dd className="font-medium">{booking.numberOfGuests}</dd></div>
                <div><dt className="text-gray-500">Total</dt><dd className="font-medium">{currencyFormatter.format(booking.totalAmount || 0)}</dd></div>
                <div><dt className="text-gray-500">Booking status</dt><dd className="font-medium">{booking.bookingStatus}</dd></div>
                <div><dt className="text-gray-500">Payment status</dt><dd className="font-medium">{booking.paymentStatus}</dd></div>
                {booking.rejectionReason ? <div><dt className="text-gray-500">Rejection</dt><dd className="font-medium">{booking.rejectionReason}</dd></div> : null}
                {booking.adminNote ? <div><dt className="text-gray-500">Admin note</dt><dd className="font-medium">{booking.adminNote}</dd></div> : null}
              </dl>
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Invoice</h2>
              {invoice ? (
                <dl className="mt-4 space-y-3 text-sm">
                  <div><dt className="text-gray-500">Number</dt><dd className="font-medium">{invoice.invoiceNumber}</dd></div>
                  <div><dt className="text-gray-500">Status</dt><dd className="font-medium">{invoice.invoiceStatus}</dd></div>
                  <div><dt className="text-gray-500">Issued</dt><dd className="font-medium">{formatDate(invoice.issuedAt)}</dd></div>
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

            <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Review Payment</h2>
              <textarea name="adminNote" value={form.adminNote} onChange={handleChange} placeholder="Admin note" className="mt-4 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
              <select name="rejectionReason" value={form.rejectionReason} onChange={handleChange} className="mt-3 min-h-11 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
                {rejectionOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => runPaymentAction("approve")} disabled={loading || booking.bookingStatus === "success"} className="min-h-11 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                  Approve
                </button>
                <button type="button" onClick={() => runPaymentAction("reject")} disabled={loading || booking.bookingStatus === "success"} className="min-h-11 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
                  Reject
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default BookingDetail;
