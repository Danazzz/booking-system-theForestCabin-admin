import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const emptyForm = {
  name: "",
  description: "",
  imageUrl: "",
  adjustmentType: "none",
  adjustmentValue: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
  image: null
};

const promoSortAccessors = {
  name: (promo) => promo.name,
  validFrom: (promo) => promo.validFrom || "",
  validUntil: (promo) => promo.validUntil || "",
  adjustment: (promo) => promo.adjustmentValue || 0,
  status: (promo) => promo.isActive
};

const adjustmentLabels = {
  none: "No price change",
  percentage_discount: "Percentage discount",
  fixed_discount: "Fixed discount",
  bundle_price: "Bundle price",
  surcharge: "Surcharge"
};

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const buildPayload = (form) => {
  const payload = new FormData();

  payload.append("name", form.name);
  payload.append("description", form.description || "");
  payload.append("imageUrl", form.imageUrl || "");
  payload.append("adjustmentType", form.adjustmentType);
  payload.append("adjustmentValue", form.adjustmentValue || 0);
  payload.append("validFrom", form.validFrom || "");
  payload.append("validUntil", form.validUntil || "");
  payload.append("isActive", String(form.isActive));

  if (form.image) {
    payload.append("image", form.image);
  }

  return payload;
};

const formatRule = (promo) => {
  const value = Number(promo.adjustmentValue || 0).toLocaleString();

  if (promo.adjustmentType === "percentage_discount") {
    return `${value}% discount`;
  }

  if (promo.adjustmentType === "fixed_discount") {
    return `Discount ${value}`;
  }

  if (promo.adjustmentType === "bundle_price") {
    return `Bundle ${value}`;
  }

  if (promo.adjustmentType === "surcharge") {
    return `Add ${value}`;
  }

  return "No price change";
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
  } = useSortableData(promos, promoSortAccessors, { key: "validUntil", direction: "desc" });

  const loadPromos = async () => {
    const response = await api.get("/admin/promos?includeInactive=true");
    setPromos(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialPromos = async () => {
      try {
        const response = await api.get("/admin/promos?includeInactive=true");

        if (!ignore) {
          setPromos(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, "Failed to load promos"));
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
    setLoading(true);

    try {
      const payload = buildPayload(form);

      if (editingId) {
        await api.patch(`/admin/promos/${editingId}`, payload);
        setMessage("Promo updated");
      } else {
        await api.post("/admin/promos", payload);
        setMessage("Promo created");
      }

      resetForm();
      await loadPromos();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save promo"));
    } finally {
      setLoading(false);
    }
  };

  const editPromo = (promo) => {
    setEditingId(promo._id);
    setForm({
      name: promo.name || "",
      description: promo.description || "",
      imageUrl: promo.imageUrl || "",
      adjustmentType: promo.adjustmentType || "none",
      adjustmentValue: promo.adjustmentValue || "",
      validFrom: toDateInput(promo.validFrom),
      validUntil: toDateInput(promo.validUntil),
      isActive: Boolean(promo.isActive),
      image: null
    });
  };

  const togglePromo = async (promo) => {
    setError("");
    setMessage("");

    try {
      const response = promo.isActive
        ? await api.delete(`/admin/promos/${promo._id}`)
        : await api.patch(`/admin/promos/${promo._id}`, { isActive: true });

      setPromos((current) => current.map((item) => (
        item._id === promo._id ? response.data.data : item
      )));
      setMessage(response.data.data.isActive ? "Promo enabled" : "Promo disabled");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update promo"));
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Promos</h1>
        <p className="mt-1 text-sm text-gray-500">Manage booking promos, date validity, images, and price rules.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <input name="name" value={form.name} onChange={handleChange} required placeholder="Promo name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="validFrom" type="date" value={form.validFrom} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="validUntil" type="date" value={form.validUntil} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <select name="adjustmentType" value={form.adjustmentType} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="none">No price change</option>
          <option value="percentage_discount">Percentage discount</option>
          <option value="fixed_discount">Fixed discount</option>
          <option value="bundle_price">Bundle price</option>
          <option value="surcharge">Surcharge</option>
        </select>
        <input name="adjustmentValue" type="number" min="0" value={form.adjustmentValue} onChange={handleChange} placeholder="Promo value" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="Background image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Promo description" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-4" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-4">
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
        <table className="min-w-[1040px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Valid from" sortKey="validFrom" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Valid until" sortKey="validUntil" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Price rule" sortKey="adjustment" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedPromos.map((promo) => (
              <tr key={promo._id}>
                <td className="px-4 py-3">
                  {promo.imageUrl ? (
                    <img src={promo.imageUrl} alt={promo.name} className="h-14 w-20 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">No image</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{promo.name}</p>
                  <p className="line-clamp-2 max-w-sm text-xs text-gray-500">{promo.description || "-"}</p>
                </td>
                <td className="px-4 py-3">{toDateInput(promo.validFrom) || "-"}</td>
                <td className="px-4 py-3">{toDateInput(promo.validUntil) || "-"}</td>
                <td className="px-4 py-3">{adjustmentLabels[promo.adjustmentType || "none"]} · {formatRule(promo)}</td>
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
                <td className="px-4 py-6 text-center text-gray-500" colSpan="7">No promos found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Promos;
