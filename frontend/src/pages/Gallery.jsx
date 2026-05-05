import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = {
  title: "",
  imageUrl: "",
  altText: "",
  sortOrder: "",
  image: null
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.response?.data?.error || fallback;

const buildPayload = (form) => {
  const payload = new FormData();

  payload.append("title", form.title);
  payload.append("imageUrl", form.imageUrl || "");
  payload.append("altText", form.altText || "");
  payload.append("sortOrder", form.sortOrder || 0);

  if (form.image) {
    payload.append("image", form.image);
  }

  return payload;
};

function Gallery() {
  const [images, setImages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadImages = async () => {
    const response = await api.get("/admin/gallery");
    setImages(response.data.data || []);
  };

  useEffect(() => {
    let ignore = false;

    const loadInitialImages = async () => {
      try {
        const response = await api.get("/admin/gallery");

        if (!ignore) {
          setImages(response.data.data || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(getErrorMessage(err, "Failed to load gallery"));
        }
      }
    };

    loadInitialImages();

    return () => {
      ignore = true;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, files } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "file" ? files?.[0] || null : value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await api.post("/admin/gallery", buildPayload(form));
      setForm(emptyForm);
      setMessage("Gallery image saved");
      await loadImages();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save gallery image"));
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (imageId) => {
    if (!window.confirm("Delete this gallery image?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await api.delete(`/admin/gallery/${imageId}`);
      setMessage("Gallery image deleted");
      await loadImages();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete gallery image"));
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <p className="mt-1 text-sm text-gray-500">Upload, list, and delete user frontend gallery images.</p>
      </div>

      <form className="grid gap-4 rounded-md border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-4" onSubmit={handleSubmit}>
        <input name="title" value={form.title} onChange={handleChange} required placeholder="Image title" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="sortOrder" type="number" value={form.sortOrder} onChange={handleChange} placeholder="Sort order" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900" />
        <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="Image URL" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="min-h-11 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <input name="altText" value={form.altText} onChange={handleChange} placeholder="Alt text" className="min-h-11 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 md:col-span-2" />
        <div className="md:col-span-4">
          <button type="submit" disabled={loading} className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-400">
            {loading ? "Saving..." : "Save gallery image"}
          </button>
        </div>
      </form>

      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {images.map((image) => (
          <article key={image._id} className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
            <img src={image.imageUrl} alt={image.altText || image.title} className="h-52 w-full object-cover" />
            <div className="space-y-3 p-4">
              <div>
                <p className="font-medium text-gray-900">{image.title}</p>
                <p className="text-sm text-gray-500">Sort order: {image.sortOrder || 0}</p>
              </div>
              <button type="button" onClick={() => deleteImage(image._id)} className="min-h-10 rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700">
                Delete
              </button>
            </div>
          </article>
        ))}
        {!images.length ? (
          <p className="rounded-md border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 sm:col-span-2 xl:col-span-3">
            No gallery images found.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default Gallery;
