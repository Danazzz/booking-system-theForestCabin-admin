import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const emptyForm = {
  name: "",
  type: "",
  isActive: true
};

const channelSortAccessors = {
  name: (channel) => channel.name,
  type: (channel) => channel.type,
  status: (channel) => channel.isActive
};

function Channels() {
  const [channels, setChannels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    sortedItems: sortedChannels,
    sortConfig,
    requestSort
  } = useSortableData(channels, channelSortAccessors, { key: "name", direction: "asc" });

  const loadChannels = async (params = {}) => {
    const response = await api.get("/channels", { params });
    setChannels(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialChannels = async () => {
      try {
        const response = await api.get("/channels");

        if (!ignore) {
          setChannels(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load channels");
        }
      }
    };

    loadInitialChannels();

    return () => {
      ignore = true;
    };
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (editingId) {
        const updates = { ...form };
        await api.patch(`/channels/${editingId}`, updates);
        setMessage("Channel updated");
      } else {
        await api.post("/channels", form);
        setMessage("Channel created");
      }

      resetForm();
      await loadChannels();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save channel");
    } finally {
      setLoading(false);
    }
  };

  const editChannel = (channel) => {
    setEditingId(channel._id);
    setForm({
      name: channel.name || "",
      type: channel.type || "",
      isActive: Boolean(channel.isActive)
    });
  };

  const deleteChannel = async (channelId) => {
    if (!window.confirm("Disable this channel?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/channels/${channelId}`);
      setMessage("Channel disabled");
      await loadChannels();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to disable channel");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Channels</h1>
        <p className="mt-1 text-sm text-gray-500">Manage dynamic booking sources.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <input name="name" value={form.name} onChange={handleChange} required placeholder="Channel name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="type" value={form.type} onChange={handleChange} required placeholder="Type" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-4">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update channel" : "Create channel"}
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
        <table className="min-w-[640px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Type" sortKey="type" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedChannels.map((channel) => (
              <tr key={channel._id}>
                <td className="px-4 py-3">{channel.name}</td>
                <td className="px-4 py-3">{channel.type}</td>
                <td className="px-4 py-3">{channel.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editChannel(channel)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => deleteChannel(channel._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">Disable</button>
                  </div>
                </td>
              </tr>
            ))}
            {!channels.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="4">No channels found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Channels;
