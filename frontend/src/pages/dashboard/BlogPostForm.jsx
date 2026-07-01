import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/dashboard/DashboardLayout";
import TipTapEditor from "../../components/blog/TipTapEditor";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import Loader from "../../components/common/Loader";

const BlogPostForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    featured_image: "",
    blog_category_id: "",
    tags: [],
    status: "draft",
    meta_title: "",
    meta_description: "",
    og_image: "",
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false);

  useEffect(() => {
    if (token) {
      loadCategories();
      if (isEditMode) {
        loadPost();
      }
    }
  }, [token, id]);

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/categories`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setCategories(data || []);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const loadPost = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/posts/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load post");
      }

      const data = await response.json();
      setFormData({
        title: data.title || "",
        slug: data.slug || "",
        excerpt: data.excerpt || "",
        content: data.content || "",
        featured_image: data.featured_image || "",
        blog_category_id: data.blog_category_id || "",
        tags: data.tags?.map((t) => t.name) || [],
        status: data.status || "draft",
        meta_title: data.meta_title || "",
        meta_description: data.meta_description || "",
        og_image: data.og_image || "",
      });
    } catch (err) {
      console.error("Failed to load post:", err);
      toast.error("Failed to load blog post");
      navigate("/admin/blog/posts");
    } finally {
      setLoading(false);
    }
  };

  const handleFeaturedImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingFeaturedImage(true);
    const uploadFormData = new FormData();
    uploadFormData.append("image", file);
    uploadFormData.append("type", "featured");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/images`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: uploadFormData,
        },
      );

      if (!response.ok) {
        throw new Error("Image upload failed");
      }

      const data = await response.json();
      setFormData((prev) => ({
        ...prev,
        featured_image: data.path,
      }));
      toast.success("Featured image uploaded successfully!");
    } catch (error) {
      console.error("Featured image upload error:", error);
      toast.error("Featured image upload failed. Please try again.");
    } finally {
      setUploadingFeaturedImage(false);
    }
  };

  const handleSubmit = async (e, statusOverride) => {
    e.preventDefault();
    setSaving(true);

    // Use statusOverride if provided, otherwise use formData.status
    const submitData = {
      ...formData,
      status: statusOverride || formData.status,
    };

    try {
      const url = isEditMode
        ? `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/posts/${id}`
        : `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/posts`;

      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save post");
      }

      const data = await response.json();
      toast.success(
        `Blog post ${isEditMode ? "updated" : "created"} successfully!`,
      );
      navigate("/admin/blog/posts");
    } catch (error) {
      console.error("Save error:", error);
      toast.error(
        error.message || "Failed to save blog post. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-3xl font-bold">
              {isEditMode ? "Edit Blog Post" : "Create New Blog Post"}
            </h1>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin/blog/posts")}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 bg-white transition-colors"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e, "draft")}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-sm"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={(e) => handleSubmit(e, "published")}
                className="px-6 py-2 bg-[#c7f135] text-[#10182a] rounded-lg hover:bg-[#b0dc00] disabled:opacity-50 transition-colors shadow-md"
                disabled={saving}
              >
                {saving ? "Publishing..." : "Publish Post"}
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
              placeholder="Enter blog post title"
              required
            />
          </div>

          {/* Slug (optional) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Slug (optional)
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
              placeholder="custom-url-slug (leave blank for auto-generation)"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={formData.blog_category_id}
              onChange={(e) =>
                setFormData({ ...formData, blog_category_id: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium mb-2">Excerpt</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) =>
                setFormData({ ...formData, excerpt: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
              rows="3"
              placeholder="Short summary of the post (used in listings and meta description)"
            />
          </div>

          {/* Featured Image */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Featured Image
            </label>
            {formData.featured_image && (
              <div className="mb-2">
                <img
                  src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/storage/${formData.featured_image}`}
                  alt="Featured"
                  className="w-48 h-32 object-cover rounded-lg"
                />
              </div>
            )}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={handleFeaturedImageUpload}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
              disabled={uploadingFeaturedImage}
            />
            <p className="text-sm text-gray-500 mt-2">
              Accepted formats: JPG, JPEG, PNG, WebP
            </p>
            {uploadingFeaturedImage && (
              <p className="text-sm text-gray-500 mt-2">Uploading...</p>
            )}
          </div>

          {/* Content Editor */}
          <div>
            <label className="block text-sm font-medium mb-2">Content *</label>
            <TipTapEditor
              content={formData.content}
              onChange={(html) => setFormData({ ...formData, content: html })}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>
            <input
              type="text"
              value={formData.tags.join(", ")}
              onChange={(e) => {
                const value = e.target.value;
                // If the user just typed a comma or is in the middle of typing,
                // we should allow it in the local state or handle it gracefully.
                // However, the current logic splits and rejoins immediately,
                // which prevents trailing commas from being typed.
                setFormData({
                  ...formData,
                  tags: value.split(",").map((tag) => tag.trimStart()),
                });
              }}
              onBlur={() => {
                // Clean up tags on blur (remove empty and trim)
                setFormData({
                  ...formData,
                  tags: formData.tags.map((tag) => tag.trim()).filter(Boolean),
                });
              }}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
              placeholder="travel, destinations, tips (comma-separated)"
            />
          </div>

          {/* SEO Fields */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold mb-4">SEO Settings (Optional)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Meta Title
                </label>
                <input
                  type="text"
                  value={formData.meta_title}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_title: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
                  placeholder="Custom SEO title (defaults to post title)"
                  maxLength="160"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Meta Description
                </label>
                <textarea
                  value={formData.meta_description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      meta_description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#c7f135]"
                  rows="2"
                  placeholder="Custom SEO description (defaults to excerpt)"
                  maxLength="300"
                />
              </div>
            </div>
          </div>

          <div className="h-4 border-b border-dashed mb-8 opacity-50"></div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default BlogPostForm;
