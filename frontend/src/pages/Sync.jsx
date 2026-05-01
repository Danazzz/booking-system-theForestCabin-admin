import { useEffect, useState } from "react";
import api from "../api/axios";

const CHANNEL_OPTION_LIMIT = 20;
const OTHER_CHANNEL = "__other__";

const initialForm = {
  url: "",
  roomId: "",
  sourceName: "",
  channelId: "",
  roomCount: ""
};

const isValidIcalUrl = (url) => {
  const value = url.trim().toLowerCase();

  return /^https?:\/\//.test(value) && value.includes(".ics");
};

function Sync() {
  const [form, setForm] = useState(initialForm);
  const [rooms, setRooms] = useState([]);
  const [channels, setChannels] = useState([]);
  const [sourceMode, setSourceMode] = useState("select");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const hasChannelDropdown = channels.length > 0 && channels.length <= CHANNEL_OPTION_LIMIT;

  useEffect(() => {
    let ignore = false;

    const loadOptions = async () => {
      setOptionsLoading(true);

      try {
        const [roomsResponse, channelsResponse] = await Promise.all([
          api.get("/rooms"),
          api.get("/channels")
        ]);

        if (!ignore) {
          setRooms((roomsResponse.data.data || []).filter((room) => room.isActive !== false));
          setChannels((channelsResponse.data.data || []).filter((channel) => channel.isActive !== false));
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load rooms or channels");
        }
      } finally {
        if (!ignore) {
          setOptionsLoading(false);
        }
      }
    };

    loadOptions();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
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

    const channel = channels.find((item) => item._id === value);
    setSourceMode("select");
    setForm((current) => ({
      ...current,
      channelId: channel?._id || "",
      sourceName: channel?.name || ""
    }));
  };

  const validateForm = () => {
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== "")
    );

    try {
      setLoading(true);
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
          type="url"
          inputMode="url"
          placeholder="iCal URL"
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
              {channels.map((channel) => (
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
