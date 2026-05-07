import { useState } from "react";
import api from "../api/axios";

const toInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getInitialFilters = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: toInputDate(startDate),
    endDate: toInputDate(endDate)
  };
};

const getFilenameFromHeaders = (headers, fallback) => {
  const disposition = headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);

  return match?.[1] || fallback;
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const readBlobError = async (error, fallback) => {
  const data = error.response?.data;

  if (data instanceof Blob) {
    const text = await data.text();

    try {
      const parsed = JSON.parse(text);
      return parsed.message || fallback;
    } catch {
      return text || fallback;
    }
  }

  return error.response?.data?.message || fallback;
};

function DataExport() {
  const [filters, setFilters] = useState(getInitialFilters);
  const [loadingType, setLoadingType] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleChange = (event) => {
    setFilters((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const downloadExport = async ({ endpoint, type, fallbackFilename }) => {
    setError("");
    setMessage("");
    setLoadingType(type);

    try {
      const response = await api.get(endpoint, {
        params: filters,
        responseType: "blob"
      });
      const filename = getFilenameFromHeaders(response.headers, fallbackFilename);

      downloadBlob(response.data, filename);
      setMessage("Export downloaded successfully.");
    } catch (err) {
      setError(await readBlobError(err, "Failed to download export"));
    } finally {
      setLoadingType("");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Export</h1>
        <p className="mt-1 text-sm text-gray-500">
          Download operational backups for bookings, occupancy, invoices, and income.
        </p>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            name="startDate"
            type="date"
            value={filters.startDate}
            onChange={handleChange}
            required
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <input
            name="endDate"
            type="date"
            value={filters.endDate}
            onChange={handleChange}
            required
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <div className="flex min-h-11 items-center rounded-md bg-gray-50 px-3 text-sm text-gray-600">
            CSV opens in Excel
          </div>
        </div>
      </div>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Bookings + Occupancy</h2>
          <p className="mt-2 text-sm text-gray-600">
            Exports all bookings that overlap the selected stay range, plus room type occupancy
            and income by source. Only successful paid bookings count as occupancy.
          </p>
          <button
            type="button"
            onClick={() =>
              downloadExport({
                endpoint: "/admin/exports/bookings-occupancy.csv",
                type: "bookings",
                fallbackFilename: "bookings-occupancy.csv"
              })
            }
            disabled={loadingType === "bookings"}
            className="mt-4 min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            {loadingType === "bookings" ? "Preparing..." : "Download CSV"}
          </button>
        </article>

        <article className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Invoices + Income</h2>
          <p className="mt-2 text-sm text-gray-600">
            Exports invoices issued within the selected date range, including invoice email
            status, paid income totals, payment method breakdown, and source breakdown.
          </p>
          <button
            type="button"
            onClick={() =>
              downloadExport({
                endpoint: "/admin/exports/invoices-income.csv",
                type: "invoices",
                fallbackFilename: "invoices-income.csv"
              })
            }
            disabled={loadingType === "invoices"}
            className="mt-4 min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            {loadingType === "invoices" ? "Preparing..." : "Download CSV"}
          </button>
        </article>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Keep these files private. They contain guest names, contact details, payment status,
        invoice data, and operational income information.
      </div>
    </section>
  );
}

export default DataExport;
