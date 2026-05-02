import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const emptyForm = {
  name: "",
  description: "",
  isActive: true
};

const promoSortAccessors = {
  name: (promo) => promo.name,
  description: (promo) => promo.description || "",
  status: (promo) => promo.isActive
};

function Promos() {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    sortedItems: sortedPromos,
    sortConfig,
    requestSort
  } = useSortableData(promos, promoSortAccessors, { key: "name", direction: "asc" });

  const loadPromos = async () => {
    const response = await api.get("/promos");
    setPromos(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialPromos = async () => {
      try {
        const response = await api.get("/promos");

        if (!ignore) {
          setPromos(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load promos");
        }
      }
    };

    loadInitialPromos();

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
        await api.patch(`/promos/${editingId}`, form);
        setMessage("Promo updated");
      } else {
        await api.post("/promos", form);
        setMessage("Promo created");
      }

      resetForm();
      await loadPromos();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save promo");
    } finally {
      setLoading(false);
    }
  };

  const editPromo = (promo) => {
    setEditingId(promo._id);
    setForm({
      name: promo.name || "",
      description: promo.description || "",
      isActive: Boolean(promo.isActive)
    });
  };

  const togglePromo = async (promo) => {
    if (promo.isActive && !window.confirm("Disable this promo? Existing bookings will keep their promo history.")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = promo.isActive
        ? await api.delete(`/promos/${promo._id}`)
        : await api.patch(`/promos/${promo._id}`, { isActive: true });

      setPromos((current) => current.map((item) => (
        item._id === promo._id ? response.data.data : item
      )));
      setMessage(response.data.data.isActive ? "Promo enabled" : "Promo disabled");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update promo");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Promos</h1>
        <p className="mt-1 text-sm text-gray-500">Manage selectable booking promos.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={handleSubmit}>
        <input name="name" value={form.name} onChange={handleChange} required placeholder="Promo name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="description" value={form.description} onChange={handleChange} placeholder="Description" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-3">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update promo" : "Create promo"}
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
        <table className="min-w-[760px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Description" sortKey="description" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPromos.map((promo) => (
              <tr key={promo._id}>
                <td className="px-4 py-3 font-medium">{promo.name}</td>
                <td className="px-4 py-3">{promo.description || "-"}</td>
                <td className="px-4 py-3">{promo.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editPromo(promo)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => togglePromo(promo)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">
                      {promo.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!promos.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="4">No promos found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Promos;
