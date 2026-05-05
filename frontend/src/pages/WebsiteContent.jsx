import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const contentTypes = [
  { value: "promo", label: "Promos" },
  { value: "accommodation", label: "Accommodations" },
  { value: "gallery", label: "Gallery" }
];

const emptyForm = {
  type: "promo",
  title: "",
  description: "",
  imageUrl: "",
  altText: "",
  details: "",
  sortOrder: "",
  isActive: true,
  image: null
};

const contentSortAccessors = {
  type: (item) => item.type,
  title: (item) => item.title,
  sortOrder: (item) => item.sortOrder || 0,
  status: (item) => item.isActive
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const buildPayload = (form) => {
  const payload = new FormData();

  payload.append("type", form.type);
  payload.append("title", form.title);
  payload.append("description", form.description || "");
  payload.append("imageUrl", form.imageUrl || "");
  payload.append("altText", form.altText || "");
  payload.append("details", form.details || "");
  payload.append("sortOrder", form.sortOrder || 0);
  payload.append("isActive", String(form.isActive));

  if (form.image) {
    payload.append("image", form.image);
  }

  return payload;
};

function WebsiteContent() {
  const [content, setContent] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    sortedItems,
    sortConfig,
    requestSort
  } = useSortableData(content, contentSortAccessors, { key: "sortOrder", direction: "asc" });

  const loadContent = async () => {
    const search = new URLSearchParams({
      includeInactive: "true"
    });

    if (filterType !== "all") {
      search.set("type", filterType);
    }

    const response = await api.get(`/admin/content?${search.toString()}`);
    setContent(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialContent = async () => {
      setError("");

      try {
        const search = new URLSearchParams({ includeInactive: "true" });

        if (filterType !== "all") {
          search.set("type", filterType);
        }

        const response = await api.get(`/admin/content?${search.toString()}`);

        if (!ignore) {
          setContent(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, "Failed to load website content"));
        }
      }
    };

    loadInitialContent();

    return () => {
      ignore = true;
    };
  }, [filterType]);

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
        await api.patch(`/admin/content/${editingId}`, payload);
        setMessage("Website content updated");
      } else {
        await api.post("/admin/content", payload);
        setMessage("Website content created");
      }

      resetForm();
      await loadContent();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save website content"));
    } finally {
      setLoading(false);
    }
  };

  const editItem = (item) => {
    setEditingId(item._id);
    setForm({
      type: item.type || "promo",
      title: item.title || "",
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      altText: item.altText || "",
      details: (item.details || []).join("\n"),
      sortOrder: item.sortOrder ?? "",
      isActive: Boolean(item.isActive),
      image: null
    });
  };

  const toggleItem = async (item) => {
    setError("");
    setMessage("");

    try {
      const response = item.isActive
        ? await api.delete(`/admin/content/${item._id}`)
        : await api.patch(`/admin/content/${item._id}`, { isActive: true });

      setContent((current) => current.map((contentItem) => (
        contentItem._id === item._id ? response.data.data : contentItem
      )));
      setMessage(response.data.data.isActive ? "Content enabled" : "Content disabled");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update website content"));
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Website Content</h1>
          <p className="mt-1 text-sm text-gray-500">Manage content shown on the user booking frontend.</p>
        </div>
        <select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="all">All content</option>
          {contentTypes.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={handleSubmit}>
        <select name="type" value={form.type} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          {contentTypes.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        <input name="title" value={form.title} onChange={handleChange} required placeholder="Title" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} placeholder="Sort order" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="Image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="altText" value={form.altText} onChange={handleChange} placeholder="Image alt text" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3" />
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Description" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3" />
        <textarea name="details" value={form.details} onChange={handleChange} placeholder="Accommodation details, one per line" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-3">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update content" : "Create content"}
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
        <table className="min-w-[980px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Preview</th>
              <SortHeader label="Type" sortKey="type" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Title" sortKey="title" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Sort" sortKey="sortOrder" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedItems.map((item) => (
              <tr key={item._id}>
                <td className="px-4 py-3">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.altText || item.title} className="h-14 w-20 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">No image</div>
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{item.type}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="line-clamp-2 max-w-md text-xs text-gray-500">{item.description || "-"}</p>
                </td>
                <td className="px-4 py-3">{item.sortOrder || 0}</td>
                <td className="px-4 py-3">{item.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editItem(item)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => toggleItem(item)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">
                      {item.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!content.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="6">No website content found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default WebsiteContent;
