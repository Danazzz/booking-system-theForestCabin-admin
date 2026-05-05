import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  paymentMethod: "manual_transfer",
  bankName: "",
  accountName: "",
  accountNumber: "",
  merchantName: "",
  qrisCode: "",
  imageUrl: "",
  instructions: "",
  isActive: true,
  image: null
};

const methodLabels = {
  manual_transfer: "Transfer Rekening",
  virtual_account: "Virtual Account",
  qris: "QRIS",
  other: "Other"
};

const methodPriority = {
  manual_transfer: 1,
  virtual_account: 2,
  qris: 3,
  other: 4
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const buildPayload = (form) => {
  const payload = new FormData();

  [
    "paymentMethod",
    "bankName",
    "accountName",
    "accountNumber",
    "merchantName",
    "qrisCode",
    "imageUrl",
    "instructions"
  ].forEach((field) => {
    payload.append(field, form[field] || "");
  });

  payload.append("isActive", String(form.isActive));

  if (form.image) {
    payload.append("image", form.image);
  }

  return payload;
};

const getPaymentTitle = (payment) => {
  if (payment.paymentMethod === "manual_transfer") {
    return `Transfer Rekening ${payment.bankName || ""}`.trim();
  }

  if (payment.paymentMethod === "virtual_account") {
    return `Virtual Account ${payment.bankName || ""}`.trim();
  }

  if (payment.paymentMethod === "qris") {
    return `QRIS ${payment.merchantName || ""}`.trim();
  }

  return payment.merchantName || payment.bankName || payment.name || "Other Payment";
};

const getPaymentSummary = (payment) => {
  if (payment.paymentMethod === "qris") {
    return payment.qrisCode || payment.merchantName || "-";
  }

  if (payment.paymentMethod === "other") {
    return [payment.accountNumber, payment.accountName].filter(Boolean).join(" · ") || "-";
  }

  return [payment.bankName, payment.accountNumber, payment.accountName]
    .filter(Boolean)
    .join(" · ") || "-";
};

const sortPayments = (payments) =>
  [...payments].sort((first, second) => {
    const priorityDiff =
      (methodPriority[first.paymentMethod] || 99) -
      (methodPriority[second.paymentMethod] || 99);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return getPaymentTitle(first).localeCompare(getPaymentTitle(second));
  });

function Payments() {
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const sortedPayments = sortPayments(payments);

  const loadPayments = async () => {
    const response = await api.get("/admin/payment-options?includeInactive=true");
    setPayments(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialPayments = async () => {
      try {
        const response = await api.get("/admin/payment-options?includeInactive=true");

        if (!ignore) {
          setPayments(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, "Failed to load payment options"));
        }
      }
    };

    loadInitialPayments();

    return () => {
      ignore = true;
    };
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target;

    if (name === "paymentMethod") {
      setForm((current) => ({
        ...emptyForm,
        paymentMethod: value,
        instructions: current.instructions,
        isActive: current.isActive
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : type === "file" ? files?.[0] || null : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload = buildPayload(form);

      if (editingId) {
        await api.patch(`/admin/payment-options/${editingId}`, payload);
        setMessage("Payment option updated");
      } else {
        await api.post("/admin/payment-options", payload);
        setMessage("Payment option created");
      }

      resetForm();
      await loadPayments();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save payment option"));
    } finally {
      setLoading(false);
    }
  };

  const editPayment = (payment) => {
    setEditingId(payment._id);
    setForm({
      paymentMethod: payment.paymentMethod || "manual_transfer",
      bankName: payment.bankName || "",
      accountName: payment.accountName || "",
      accountNumber: payment.accountNumber || "",
      merchantName: payment.merchantName || "",
      qrisCode: payment.qrisCode || "",
      imageUrl: payment.imageUrl || "",
      instructions: payment.instructions || "",
      isActive: Boolean(payment.isActive),
      image: null
    });
  };

  const togglePayment = async (payment) => {
    setError("");
    setMessage("");

    try {
      const response = payment.isActive
        ? await api.delete(`/admin/payment-options/${payment._id}`)
        : await api.patch(`/admin/payment-options/${payment._id}`, { isActive: true });

      setPayments((current) => current.map((item) => (
        item._id === payment._id ? response.data.data : item
      )));
      setMessage(response.data.data.isActive ? "Payment option enabled" : "Payment option disabled");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update payment option"));
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage manual payment methods shown to guests after booking.
        </p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <select name="paymentMethod" value={form.paymentMethod} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="manual_transfer">Transfer rekening</option>
          <option value="virtual_account">Virtual account</option>
          <option value="qris">QRIS</option>
          <option value="other">Other</option>
        </select>

        {form.paymentMethod === "qris" ? (
          <>
            <input name="merchantName" value={form.merchantName} onChange={handleChange} placeholder="Merchant name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="qrisCode" value={form.qrisCode} onChange={handleChange} placeholder="QRIS reference or static code" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="QRIS image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
          </>
        ) : null}

        {["manual_transfer", "virtual_account"].includes(form.paymentMethod) ? (
          <>
            <input name="bankName" value={form.bankName} onChange={handleChange} placeholder="Bank name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="accountName" value={form.accountName} onChange={handleChange} placeholder="Account name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="accountNumber" value={form.accountNumber} onChange={handleChange} placeholder={form.paymentMethod === "virtual_account" ? "Virtual account number" : "Account number"} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
          </>
        ) : null}

        {form.paymentMethod === "other" ? (
          <>
            <input name="merchantName" value={form.merchantName} onChange={handleChange} placeholder="Payment name, e.g. Cash on Arrival" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="accountName" value={form.accountName} onChange={handleChange} placeholder="Receiver or merchant name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="accountNumber" value={form.accountNumber} onChange={handleChange} placeholder="Reference number or link" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
            <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="Optional image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
          </>
        ) : null}

        <textarea name="instructions" value={form.instructions} onChange={handleChange} placeholder="Payment instructions shown to guests" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-4" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-4">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update payment option" : "Create payment option"}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[960px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Payment details</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPayments.map((payment) => (
              <tr key={payment._id}>
                <td className="px-4 py-3">
                  {payment.imageUrl ? (
                    <img src={payment.imageUrl} alt={getPaymentTitle(payment)} className="h-14 w-20 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">No image</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{getPaymentTitle(payment)}</p>
                  <p className="line-clamp-2 max-w-sm whitespace-pre-line text-xs text-gray-500">{payment.instructions || "-"}</p>
                </td>
                <td className="px-4 py-3">{methodLabels[payment.paymentMethod] || payment.paymentMethod}</td>
                <td className="px-4 py-3">{getPaymentSummary(payment)}</td>
                <td className="px-4 py-3">{payment.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editPayment(payment)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => togglePayment(payment)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">
                      {payment.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!payments.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="6">No payment options found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Payments;
