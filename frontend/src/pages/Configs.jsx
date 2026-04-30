import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  lowAvailabilityThreshold: "",
  syncDelayThresholdMinutes: ""
};

function Configs() {
  const [configs, setConfigs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadConfigs = async (params = {}) => {
    const response = await api.get("/configs", { params });
    setConfigs(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialConfigs = async () => {
      try {
        const response = await api.get("/configs");

        if (!ignore) {
          setConfigs(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load configs");
        }
      }
    };

    loadInitialConfigs();

    return () => {
      ignore = true;
    };
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const buildPayload = () => ({
    ...form,
    lowAvailabilityThreshold: Number(form.lowAvailabilityThreshold),
    syncDelayThresholdMinutes: Number(form.syncDelayThresholdMinutes)
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (editingId) {
        const updates = buildPayload();
        await api.patch(`/configs/${editingId}`, updates);
        setMessage("Config updated");
      } else {
        await api.post("/configs", buildPayload());
        setMessage("Config created");
      }

      resetForm();
      await loadConfigs();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save config");
    } finally {
      setLoading(false);
    }
  };

  const editConfig = (config) => {
    setEditingId(config._id);
    setForm({
      lowAvailabilityThreshold: config.lowAvailabilityThreshold,
      syncDelayThresholdMinutes: config.syncDelayThresholdMinutes
    });
  };

  const deleteConfig = async (configId) => {
    if (!window.confirm("Delete this config?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/configs/${configId}`);
      setMessage("Config deleted");
      await loadConfigs();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete config");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configs</h1>
        <p className="mt-1 text-sm text-gray-500">Manage alert and sync thresholds.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={handleSubmit}>
        <input name="lowAvailabilityThreshold" type="number" min="0" value={form.lowAvailabilityThreshold} onChange={handleChange} required placeholder="Low availability threshold" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="syncDelayThresholdMinutes" type="number" min="1" value={form.syncDelayThresholdMinutes} onChange={handleChange} required placeholder="Sync delay minutes" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-3">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update config" : "Create config"}
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
              <th className="px-4 py-3">Low availability</th>
              <th className="px-4 py-3">Sync delay</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {configs.map((config) => (
              <tr key={config._id}>
                <td className="px-4 py-3">{config.lowAvailabilityThreshold}</td>
                <td className="px-4 py-3">{config.syncDelayThresholdMinutes} min</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editConfig(config)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => deleteConfig(config._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!configs.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="3">No configs found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Configs;
