import { useState } from "react";
import api from "../api/axios";

const initialForm = {
  url: "",
  roomId: "",
  sourceName: "",
  channelId: "",
  roomCount: ""
};

function Sync() {
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== "")
    );

    try {
      const response = await api.post("/api/sync-ical", payload);
      setResult({
        message: response.data.message,
        ...(response.data.data || response.data)
      });
    } catch (err) {
      setError(err.response?.data?.error || "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sync</h1>
        <p className="mt-1 text-sm text-gray-500">Run OTA iCal sync manually.</p>
      </div>

      <form className="grid max-w-3xl gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
        <input
          name="url"
          value={form.url}
          onChange={handleChange}
          required
          placeholder="iCal URL"
          className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="roomId"
            value={form.roomId}
            onChange={handleChange}
            required
            placeholder="Room ID"
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <input
            name="sourceName"
            value={form.sourceName}
            onChange={handleChange}
            required
            placeholder="Channel name"
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <input
            name="channelId"
            value={form.channelId}
            onChange={handleChange}
            placeholder="Channel ID"
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
          <input
            name="roomCount"
            type="number"
            min="1"
            value={form.roomCount}
            onChange={handleChange}
            required
            placeholder="Room count"
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400 sm:w-fit"
        >
          {loading ? "Syncing..." : "Sync OTA (iCal)"}
        </button>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {result ? (
        <div className="max-w-3xl rounded-md border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold text-gray-900">{result.message}</p>
          <dl className="mt-3 grid gap-2 md:grid-cols-4">
            <div>
              <dt className="text-gray-500">Inserted</dt>
              <dd className="font-semibold">{result.inserted ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Updated</dt>
              <dd className="font-semibold">{result.updated ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Cancelled</dt>
              <dd className="font-semibold">{result.cancelled ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Conflicts</dt>
              <dd className="font-semibold text-red-700">{result.conflicts ?? 0}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}

export default Sync;
