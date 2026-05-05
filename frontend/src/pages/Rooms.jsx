import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const emptyForm = {
  name: "",
  roomNumber: "",
  roomType: "deluxe",
  capacity: "",
  basePrice: "",
  status: "active"
};

const roomSortAccessors = {
  name: (room) => room.name,
  roomNumber: (room) => room.roomNumber,
  roomType: (room) => room.roomType,
  capacity: (room) => room.capacity || 0,
  basePrice: (room) => room.basePrice || 0,
  status: (room) => room.status
};

function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const {
    sortedItems,
    sortConfig,
    requestSort
  } = useSortableData(rooms, roomSortAccessors, { key: "roomNumber", direction: "asc" });

  const loadRooms = async () => {
    const response = await api.get("/rooms");
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
          setError(err.response?.data?.message || "Failed to load rooms");
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
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const payload = {
      ...form,
      capacity: Number(form.capacity),
      basePrice: Number(form.basePrice || 0)
    };

    try {
      if (editingId) {
        await api.patch(`/rooms/${editingId}`, payload);
        setMessage("Room updated");
      } else {
        await api.post("/rooms", payload);
        setMessage("Room created");
      }

      resetForm();
      await loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save room");
    } finally {
      setLoading(false);
    }
  };

  const editRoom = (room) => {
    setEditingId(room._id);
    setForm({
      name: room.name || "",
      roomNumber: room.roomNumber || "",
      roomType: room.roomType || "deluxe",
      capacity: room.capacity || "",
      basePrice: room.basePrice || "",
      status: room.status || "active"
    });
  };

  const deleteRoom = async (roomId) => {
    if (!window.confirm("Mark this room inactive?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/rooms/${roomId}`);
      setMessage("Room marked inactive");
      await loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update room");
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <p className="mt-1 text-sm text-gray-500">The Forest Cabin inventory used by the booking and calendar APIs.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3" onSubmit={handleSubmit}>
        <input name="name" value={form.name} onChange={handleChange} required placeholder="Room name" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="roomNumber" value={form.roomNumber} onChange={handleChange} required placeholder="Room number, e.g. 101" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <select name="roomType" value={form.roomType} onChange={handleChange} required className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="deluxe">Deluxe</option>
          <option value="suite">Suite</option>
          <option value="superior">Superior</option>
        </select>
        <input name="capacity" type="number" min="1" value={form.capacity} onChange={handleChange} required placeholder="Capacity" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="basePrice" type="number" min="0" value={form.basePrice} onChange={handleChange} placeholder="Base price" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <select name="status" value={form.status} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
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
        <table className="min-w-[840px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <SortHeader label="Room number" sortKey="roomNumber" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Room type" sortKey="roomType" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Capacity" sortKey="capacity" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Base price" sortKey="basePrice" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedItems.map((room) => (
              <tr key={room._id}>
                <td className="px-4 py-3 font-medium text-gray-900">{room.roomNumber}</td>
                <td className="px-4 py-3 capitalize">{room.roomType}</td>
                <td className="px-4 py-3">{room.name}</td>
                <td className="px-4 py-3">{room.capacity}</td>
                <td className="px-4 py-3">{Number(room.basePrice || 0).toLocaleString()}</td>
                <td className="px-4 py-3 capitalize">{room.status}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => editRoom(room)} className="min-h-10 rounded-md border border-gray-300 px-3 py-1 text-sm">Edit</button>
                    <button type="button" onClick={() => deleteRoom(room._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">Inactive</button>
                  </div>
                </td>
              </tr>
            ))}
            {!rooms.length ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan="7">No rooms found. Run the backend room seed script first.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Rooms;
