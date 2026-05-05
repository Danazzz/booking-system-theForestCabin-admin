import { useEffect, useState } from "react";
import api from "../api/axios";

const defaultForm = {
  businessName: "",
  businessEmail: "",
  businessPhone: "",
  businessAddress: "",
  websiteUrl: "",
  logoUrl: "",
  invoicePrefix: "INV",
  headerNote: "",
  footerNote: "",
  termsAndConditions: "",
  paymentConfirmationNote: "",
  emailSubject: "",
  emailMessage: "",
  emailClosingNote: "",
  emailButtonLabel: "",
  autoSendInvoiceEmail: true,
  includeBookingStatusLink: true,
  primaryColor: "#174f37",
  accentColor: "#f6f3ea",
  image: null
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const buildPayload = (form) => {
  const payload = new FormData();

  [
    "businessName",
    "businessEmail",
    "businessPhone",
    "businessAddress",
    "websiteUrl",
    "logoUrl",
    "invoicePrefix",
    "headerNote",
    "footerNote",
    "termsAndConditions",
    "paymentConfirmationNote",
    "emailSubject",
    "emailMessage",
    "emailClosingNote",
    "emailButtonLabel",
    "primaryColor",
    "accentColor"
  ].forEach((field) => {
    payload.append(field, form[field] || "");
  });

  payload.append("autoSendInvoiceEmail", String(form.autoSendInvoiceEmail));
  payload.append("includeBookingStatusLink", String(form.includeBookingStatusLink));

  if (form.image) {
    payload.append("image", form.image);
  }

  return payload;
};

function InvoiceSettings() {
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/invoice-settings");
      const settings = response.data.data || {};

      setForm({
        ...defaultForm,
        ...settings,
        image: null
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load invoice settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialSettings = async () => {
      try {
        const response = await api.get("/admin/invoice-settings");

        if (!ignore) {
          setForm({
            ...defaultForm,
            ...(response.data.data || {}),
            image: null
          });
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, "Failed to load invoice settings"));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadInitialSettings();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked, files } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : type === "file" ? files?.[0] || null : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await api.patch("/admin/invoice-settings", buildPayload(form));

      setForm({
        ...defaultForm,
        ...(response.data.data || {}),
        image: null
      });
      setMessage("Invoice settings updated");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update invoice settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoice Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure invoice branding, notes, numbering, and invoice email content.
          </p>
        </div>
        <button type="button" onClick={loadSettings} disabled={loading} className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:text-gray-400">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Business Info</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input name="businessName" value={form.businessName} onChange={handleChange} placeholder="Business name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="businessEmail" type="email" value={form.businessEmail} onChange={handleChange} placeholder="Business email" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="businessPhone" value={form.businessPhone} onChange={handleChange} placeholder="Phone / WhatsApp" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="websiteUrl" value={form.websiteUrl} onChange={handleChange} placeholder="Website or Instagram URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="logoUrl" value={form.logoUrl} onChange={handleChange} placeholder="Logo image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <textarea name="businessAddress" value={form.businessAddress} onChange={handleChange} placeholder="Business address" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3" />
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Numbering & Branding</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input name="invoicePrefix" value={form.invoicePrefix} onChange={handleChange} placeholder="Invoice prefix, e.g. INV" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm uppercase outline-none focus:border-gray-900" />
            <label className="text-sm text-gray-600">
              Primary color
              <input name="primaryColor" type="color" value={form.primaryColor} onChange={handleChange} className="mt-1 h-11 w-full rounded-md border border-gray-300 bg-white p-1" />
            </label>
            <label className="text-sm text-gray-600">
              Accent color
              <input name="accentColor" type="color" value={form.accentColor} onChange={handleChange} className="mt-1 h-11 w-full rounded-md border border-gray-300 bg-white p-1" />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Invoice Content</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <textarea name="headerNote" value={form.headerNote} onChange={handleChange} placeholder="Header note" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <textarea name="paymentConfirmationNote" value={form.paymentConfirmationNote} onChange={handleChange} placeholder="Payment confirmation note" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <textarea name="termsAndConditions" value={form.termsAndConditions} onChange={handleChange} placeholder="Terms and conditions" className="min-h-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <textarea name="footerNote" value={form.footerNote} onChange={handleChange} placeholder="Footer note" className="min-h-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Email Template</h2>
          <p className="mt-1 text-sm text-gray-500">
            Available variables: {"{{businessName}}"}, {"{{guestName}}"}, {"{{invoiceNumber}}"}, {"{{bookingCode}}"}, {"{{totalAmount}}"}.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <input name="emailSubject" value={form.emailSubject} onChange={handleChange} placeholder="Email subject" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
            <textarea name="emailMessage" value={form.emailMessage} onChange={handleChange} placeholder="Email message" className="min-h-28 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
            <input name="emailButtonLabel" value={form.emailButtonLabel} onChange={handleChange} placeholder="Button label" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <input name="emailClosingNote" value={form.emailClosingNote} onChange={handleChange} placeholder="Closing note" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input name="autoSendInvoiceEmail" type="checkbox" checked={form.autoSendInvoiceEmail} onChange={handleChange} />
              Auto-send invoice email after approval
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input name="includeBookingStatusLink" type="checkbox" checked={form.includeBookingStatusLink} onChange={handleChange} />
              Include booking status link
            </label>
          </div>
        </div>

        <button type="submit" disabled={saving} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
          {saving ? "Saving..." : "Save invoice settings"}
        </button>
      </form>
    </section>
  );
}

export default InvoiceSettings;
