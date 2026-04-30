import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  name: "",
  code: "",
  totalUnits: "",
  maxGuestsPerUnit: "",
  isActive: true
};

function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadRooms = async (params = {}) => {
    const response = await api.get("/rooms", { params });
    setRooms(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialRooms = async () => {
      try {
        const response = await api.get("/rooms");

        if (!ignore) {
          setRooms(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load rooms");
        }
      }
    };

    loadInitialRooms();

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

    const payload = {
      ...form,
      totalUnits: Number(form.totalUnits),
      maxGuestsPerUnit: form.maxGuestsPerUnit ? Number(form.maxGuestsPerUnit) : undefined
    };

    if (!payload.maxGuestsPerUnit) {
      delete payload.maxGuestsPerUnit;
    }

    try {
      if (editingId) {
        const updates = { ...payload };
        await api.patch(`/rooms/${editingId}`, updates);
        setMessage("Room updated");
      } else {
        await api.post("/rooms", payload);
        setMessage("Room created");
      }

      resetForm();
      await loadRooms();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save room");
    } finally {
      setLoading(false);
    }
  };

  const editRoom = (room) => {
    setEditingId(room._id);
    setForm({
      name: room.name || "",
      code: room.code || "",
      totalUnits: room.totalUnits || "",
      maxGuestsPerUnit: room.maxGuestsPerUnit || "",
      isActive: Boolean(room.isActive)
    });
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm("Delete this room? Rooms with active bookings cannot be deleted.")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/rooms/${roomId}`);
      setMessage("Room deleted");
      await loadRooms();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete room");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <p className="mt-1 text-sm text-gray-500">Create room types and manage room capacity.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={handleSubmit}>
        <input name="name" value={form.name} onChange={handleChange} required placeholder="Room name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="code" value={form.code} onChange={handleChange} required placeholder="Code" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="totalUnits" type="number" min="1" value={form.totalUnits} onChange={handleChange} required placeholder="Total units" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="maxGuestsPerUnit" type="number" min="1" value={form.maxGuestsPerUnit} onChange={handleChange} placeholder="Max guests per unit" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input name="isActive" type="checkbox" checked={form.isActive} onChange={handleChange} />
          Active
        </label>
        <div className="flex flex-col gap-2 sm:flex-row md:col-span-3">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {editingId ? "Update room" : "Create room"}
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
        <table className="min-w-[720px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Guests</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rooms.map((room) => (
              <tr key={room._id}>
                <td className="px-4 py-3">{room.name}</td>
                <td className="px-4 py-3">{room.code}</td>
                <td className="px-4 py-3">{room.totalUnits}</td>
                <td className="px-4 py-3">{room.maxGuestsPerUnit || "-"}</td>
                <td className="px-4 py-3">{room.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editRoom(room)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => deleteRoom(room._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!rooms.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="6">No rooms found.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Rooms;
