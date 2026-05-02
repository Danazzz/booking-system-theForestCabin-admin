import { useEffect, useState } from "react";
import api from "../api/axios";

const CHANNEL_OPTION_LIMIT = 20;
const OTHER_CHANNEL = "__other__";

const initialForm = {
  url: "",
  roomId: "",
  channelId: "",
  sourceName: "",
  roomCount: "1",
  isActive: true
};

const isValidIcalUrl = (url) => {
  const value = url.trim().toLowerCase();

  return /^https?:\/\//.test(value) && value.includes(".ics");
};

function Sync() {
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [sources, setSources] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [channels, setChannels] = useState([]);
  const [sourceMode, setSourceMode] = useState("select");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [syncingId, setSyncingId] = useState("");

  const activeChannels = channels.filter((channel) => channel.isActive !== false);
  const hasChannelDropdown = activeChannels.length > 0 && activeChannels.length <= CHANNEL_OPTION_LIMIT;

  const loadSources = async () => {
    const response = await api.get("/ical-sources");
    setSources(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadData = async () => {
      setOptionsLoading(true);

      try {
        const [roomsResponse, channelsResponse, sourcesResponse] = await Promise.all([
          api.get("/rooms"),
          api.get("/channels"),
          api.get("/ical-sources")
        ]);

        if (!ignore) {
          setRooms((roomsResponse.data.data || []).filter((room) => room.isActive !== false));
          setChannels(channelsResponse.data.data || []);
          setSources(sourcesResponse.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load sync data");
        }
      } finally {
        if (!ignore) {
          setOptionsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId("");
    setSourceMode("select");
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleChannelChange = (event) => {
    const value = event.target.value;

    if (value === OTHER_CHANNEL) {
      setSourceMode("other");
      setForm((current) => ({
        ...current,
        channelId: "",
        sourceName: ""
      }));
      return;
    }

    const channel = activeChannels.find((item) => item._id === value);
    setSourceMode("select");
    setForm((current) => ({
      ...current,
      channelId: channel?._id || "",
      sourceName: channel?.name || ""
    }));
  };

  const validateSourceForm = () => {
    if (!isValidIcalUrl(form.url)) {
      return "iCal URL must start with http:// or https:// and contain .ics";
    }

    if (!form.roomId) {
      return "Select a room";
    }

    if (!form.sourceName) {
      return "Select a channel";
    }

    if (!form.roomCount || Number(form.roomCount) < 1) {
      return "Room count must be at least 1";
    }

    return "";
  };

  const buildPayload = () => {
    return Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== "")
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setResult(null);

    const validationError = validateSourceForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await api.patch(`/ical-sources/${editingId}`, buildPayload());
        setMessage("iCal source updated");
      } else {
        await api.post("/ical-sources", buildPayload());
        setMessage("iCal source saved");
      }

      resetForm();
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save iCal source");
    } finally {
      setLoading(false);
    }
  };

  const editSource = (source) => {
    const channelId = source.channelId?._id || source.channelId || "";

    setEditingId(source._id);
    setSourceMode(channelId ? "select" : "other");
    setForm({
      url: source.url || source.icalUrl || "",
      roomId: source.roomId?._id || source.roomId || "",
      channelId,
      sourceName: source.sourceName || source.channelId?.name || "",
      roomCount: source.roomCount || "1",
      isActive: Boolean(source.isActive)
    });
  };

  const disableSource = async (sourceId) => {
    if (!window.confirm("Disable this iCal source?")) {
      return;
    }

    setError("");
    setMessage("");
    setResult(null);

    try {
      await api.delete(`/ical-sources/${sourceId}`);
      setMessage("iCal source disabled");
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to disable iCal source");
    }
  };

  const enableSource = async (sourceId) => {
    setError("");
    setMessage("");
    setResult(null);

    try {
      await api.patch(`/ical-sources/${sourceId}`, { isActive: true });
      setMessage("iCal source enabled");
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to enable iCal source");
    }
  };

  const syncSource = async (sourceId) => {
    setError("");
    setMessage("");
    setResult(null);
    setSyncingId(sourceId);

    try {
      const response = await api.post(`/ical-sources/${sourceId}/sync`);
      setResult({
        message: response.data.message,
        ...(response.data.data || response.data)
      });
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Sync failed");
    } finally {
      setSyncingId("");
    }
  };

  const syncAllSources = async () => {
    setError("");
    setMessage("");
    setResult(null);
    setSyncingId("all");

    try {
      const response = await api.post("/api/sync-ical");
      setResult({
        message: response.data.message,
        ...(response.data.data || response.data)
      });
      await loadSources();
    } catch (err) {
      setError(err.response?.data?.error || "Sync failed");
    } finally {
      setSyncingId("");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sync</h1>
          <p className="mt-1 text-sm text-gray-500">Save OTA iCal sources and run booking sync.</p>
        </div>
        <button
          type="button"
          onClick={syncAllSources}
          disabled={syncingId === "all"}
          className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
        >
          {syncingId === "all" ? "Syncing..." : "Sync all active"}
        </button>
      </div>

      <form className="grid max-w-4xl gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
        <input
          name="url"
          value={form.url}
          onChange={handleChange}
          required
          type="url"
          inputMode="url"
          placeholder="OTA iCal URL"
          className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <select
            name="roomId"
            value={form.roomId}
            onChange={handleChange}
            required
            disabled={optionsLoading || rooms.length === 0}
            className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          >
            <option value="">{optionsLoading ? "Loading rooms..." : "Select room"}</option>
            {rooms.map((room) => (
              <option key={room._id} value={room._id}>
                {room.name || room.code}
              </option>
            ))}
          </select>

          {hasChannelDropdown ? (
            <select
              value={sourceMode === "other" ? OTHER_CHANNEL : form.channelId}
              onChange={handleChannelChange}
              required
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            >
              <option value="">Select channel</option>
              {activeChannels.map((channel) => (
                <option key={channel._id} value={channel._id}>
                  {channel.name}
                </option>
              ))}
              <option value={OTHER_CHANNEL}>Other</option>
            </select>
          ) : null}

          {sourceMode === "other" || !hasChannelDropdown ? (
            <input
              name="sourceName"
              value={form.sourceName}
              onChange={handleChange}
              required
              placeholder="Channel name"
              className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
            />
          ) : null}

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
          <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
            <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
            Active
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400"
          >
            {editingId ? "Update source" : "Save source"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-11 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      {result ? (
        <div className="max-w-4xl rounded-md border border-gray-200 bg-white p-4 text-sm shadow-sm">
          <p className="font-semibold text-gray-900">{result.message}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <dt className="text-gray-500">Fetched</dt>
              <dd className="font-semibold">{result.fetched ?? result.sources ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Inserted</dt>
              <dd className="font-semibold">{result.inserted ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Skipped</dt>
              <dd className="font-semibold">{result.skipped ?? 0}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Rejected</dt>
              <dd className="font-semibold">{result.rejected ?? 0}</dd>
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

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-[980px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Room count</th>
              <th className="px-4 py-3">Last synced</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sources.map((source) => (
              <tr key={source._id}>
                <td className="px-4 py-3">{source.sourceName || source.channelId?.name || "-"}</td>
                <td className="px-4 py-3">{source.roomId?.name || source.roomId?.code || "-"}</td>
                <td className="max-w-72 truncate px-4 py-3" title={source.url || source.icalUrl || ""}>
                  {source.url || source.icalUrl || "-"}
                </td>
                <td className="px-4 py-3">{source.roomCount || "-"}</td>
                <td className="px-4 py-3">
                  {source.lastSyncedAt ? new Date(source.lastSyncedAt).toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3">{source.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => syncSource(source._id)} disabled={!source.isActive || syncingId === source._id} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm disabled:text-gray-400">
                      {syncingId === source._id ? "Syncing" : "Sync"}
                    </button>
                    <button type="button" onClick={() => editSource(source)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    {source.isActive ? (
                      <button type="button" onClick={() => disableSource(source._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">Disable</button>
                    ) : (
                      <button type="button" onClick={() => enableSource(source._id)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Enable</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!sources.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="7">
                  {optionsLoading ? "Loading iCal sources..." : "No iCal sources saved."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Sync;
