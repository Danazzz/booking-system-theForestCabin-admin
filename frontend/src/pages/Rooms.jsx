import { useEffect, useState } from "react";
import api from "../api/axios";
import SortHeader from "../components/SortHeader";
import { useSortableData } from "../hooks/useSortableData";

const emptyForm = {
  name: "",
  roomNumber: "",
  roomType: "",
  capacity: "",
  childCapacity: "",
  basePrice: "",
  description: "",
  imageUrl: "",
  images: [],
  altText: "",
  details: "",
  status: "active"
};

const roomSortAccessors = {
  name: (room) => room.name,
  roomNumber: (room) => room.roomNumber,
  roomType: (room) => room.roomType,
  capacity: (room) => room.capacity || 0,
  childCapacity: (room) => room.childCapacity || 0,
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
  const editingRoom = rooms.find((room) => room._id === editingId);
  const editingRoomImages = editingRoom
    ? (editingRoom.images?.length
      ? editingRoom.images
      : editingRoom.imageUrl
        ? [{ _id: "legacy-cover", url: editingRoom.imageUrl, altText: editingRoom.altText }]
        : [])
    : [];

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

  const buildPayload = () => {
    const payload = new FormData();

    payload.append("name", form.name);
    payload.append("roomNumber", form.roomNumber);
    payload.append("roomType", form.roomType);
    payload.append("capacity", Number(form.capacity));
    payload.append("childCapacity", Number(form.childCapacity || 0));
    payload.append("basePrice", Number(form.basePrice || 0));
    payload.append("description", form.description || "");
    payload.append("altText", form.altText || "");
    payload.append("details", form.details || "");
    payload.append("status", form.status);

    if (!editingId || form.imageUrl !== (editingRoom?.imageUrl || "")) {
      payload.append("imageUrl", form.imageUrl || "");
    }

    form.images.forEach((image) => {
      payload.append("images", image);
    });

    return payload;
  };

  const handleChange = (event) => {
    const { name, value, type, files } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "file" ? Array.from(files || []) : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const payload = buildPayload();

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
      roomType: room.roomType || "",
      capacity: room.capacity || "",
      childCapacity: room.childCapacity || "",
      basePrice: room.basePrice || "",
      description: room.description || "",
      imageUrl: room.imageUrl || "",
      images: [],
      altText: room.altText || "",
      details: (room.details || []).join("\n"),
      status: room.status || "active"
    });
  };

  const deleteRoomImage = async (roomId, imageId) => {
    if (!window.confirm("Delete this room photo?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/rooms/${roomId}/images/${imageId}`);
      setMessage("Room photo deleted");
      await loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete room photo");
    }
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
        <input name="roomType" value={form.roomType} onChange={handleChange} required placeholder="Room type, e.g. Twin bed" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="capacity" type="number" min="1" value={form.capacity} onChange={handleChange} required placeholder="Adult capacity" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="childCapacity" type="number" min="0" value={form.childCapacity} onChange={handleChange} placeholder="Child capacity" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="basePrice" type="number" min="0" value={form.basePrice} onChange={handleChange} placeholder="Base price" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="Optional image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="altText" value={form.altText} onChange={handleChange} placeholder="Image alt text" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <textarea name="description" value={form.description} onChange={handleChange} placeholder="Accommodation description shown on user frontend" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3" />
        <textarea name="details" value={form.details} onChange={handleChange} placeholder="Accommodation details, one per line" className="min-h-24 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-3" />
        <select name="status" value={form.status} onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900">
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="inactive">Inactive</option>
        </select>
        {editingRoomImages.length ? (
          <div className="grid gap-3 rounded-md bg-gray-50 p-3 md:col-span-3 sm:grid-cols-2 lg:grid-cols-4">
            {editingRoomImages.map((image) => (
              <div key={image._id || image.url} className="min-w-0 rounded-md border border-gray-200 bg-white p-2">
                <img src={image.url} alt={image.altText || editingRoom?.name || "Room photo"} className="h-28 w-full rounded object-cover" />
                <button
                  type="button"
                  onClick={() => deleteRoomImage(editingId, image._id)}
                  disabled={!image._id || image._id === "legacy-cover"}
                  className="mt-2 min-h-9 w-full rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 disabled:border-gray-200 disabled:text-gray-400"
                >
                  {image._id === "legacy-cover" ? "Legacy cover" : "Delete photo"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
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
        <table className="min-w-[1120px] divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Photos</th>
              <SortHeader label="Room number" sortKey="roomNumber" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Room type" sortKey="roomType" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Name" sortKey="name" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Adults" sortKey="capacity" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Children" sortKey="childCapacity" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Base price" sortKey="basePrice" sortConfig={sortConfig} onSort={requestSort} />
              <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} />
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedItems.map((room) => (
              <tr key={room._id}>
                <td className="px-4 py-3">
                  {(room.images?.[0]?.url || room.imageUrl) ? (
                    <img src={room.images?.[0]?.url || room.imageUrl} alt={room.images?.[0]?.altText || room.altText || room.name} className="h-14 w-20 rounded object-cover" />
                  ) : (
                    <div className="flex h-14 w-20 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">No image</div>
                  )}
                </td>
                <td className="px-4 py-3">{room.images?.length || (room.imageUrl ? 1 : 0)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{room.roomNumber}</td>
                <td className="px-4 py-3 capitalize">{room.roomType}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{room.name}</p>
                  <p className="line-clamp-2 max-w-sm text-xs text-gray-500">{room.description || "-"}</p>
                </td>
                <td className="px-4 py-3">{room.capacity}</td>
                <td className="px-4 py-3">{room.childCapacity || 0}</td>
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
                <td className="px-4 py-6 text-center text-gray-500" colSpan="10">No rooms found. Add your first room above.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Rooms;
