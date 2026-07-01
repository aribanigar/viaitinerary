import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Type,
  AlignLeft,
  Link as LinkIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import Modal from "../common/Modal";

const BlogCategoryList = () => {
  const { token } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    is_active: true,
  });
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/categories`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }

      const data = await response.json();
      setCategories(data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
      toast.error(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadCategories();
    }
  }, [token]);

  const openModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        is_active: category.is_active,
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: "",
        slug: "",
        description: "",
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({
      name: "",
      slug: "",
      description: "",
      is_active: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const url = editingCategory
        ? `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/categories/${editingCategory.id}`
        : `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/categories`;

      const response = await fetch(url, {
        method: editingCategory ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save category");
      }

      toast.success(
        `Category ${editingCategory ? "updated" : "created"} successfully!`,
      );
      closeModal();
      loadCategories();
    } catch (err) {
      console.error("Failed to save category:", err);
      toast.error(err.message || "Failed to save category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (categoryId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this category? Posts in this category will be uncategorized.",
      )
    ) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/categories/${categoryId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to delete category");
        }

        toast.success("Category deleted successfully!");
        loadCategories();
      } catch (err) {
        toast.error(err.message || "Failed to delete category");
      }
    }
  };

  const toggleStatus = async (category) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/categories/${category.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...category,
            is_active: !category.is_active,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update category status");
      }

      toast.success(
        `Category ${category.is_active ? "deactivated" : "activated"} successfully!`,
      );
      loadCategories();
    } catch (err) {
      toast.error(err.message || "Failed to update category status");
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Blog Categories
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Organize your blog posts with categories
            </p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Category Details
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Description
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                  Posts
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                  Status
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-medium">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-4xl bg-slate-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                      <div className="font-bold text-slate-900">
                        Loading categories...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length > 0 ? (
                filteredCategories.map((category) => (
                  <tr
                    key={category.id}
                    className="hover:bg-slate-50/50 group transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                          <Tag className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">
                            {category.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {category.slug}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-slate-600 font-medium line-clamp-1 max-w-xs">
                        {category.description || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center gap-1 font-bold text-blue-600">
                        {category.posts_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {category.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          <Eye className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                          <EyeOff className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(category)}
                          className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                          title="Edit Category"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id)}
                          className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                          title="Delete Category"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-300">
                        <Tag className="w-10 h-10" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          No categories found
                        </div>
                        <p className="text-slate-400 text-xs">
                          {searchQuery
                            ? "Try a different search term."
                            : "Start by adding your first category."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Category"
        isEditing={!!editingCategory}
        submitting={submitting}
        onSubmit={handleSubmit}
        submitButtonText="Save Category"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Category Name
            </label>
            <div className="relative group">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="e.g. Travel Tips"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Slug (Optional)
            </label>
            <div className="relative group">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="travel-tips (auto-generated if blank)"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Description
            </label>
            <div className="relative group">
              <AlignLeft className="absolute left-4 top-5 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium resize-none"
                rows="3"
                placeholder="Brief description of this category"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <div className="text-sm font-bold text-slate-900">
                Display Status
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Toggle visibility on blog
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#c7f135]"></div>
            </label>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default BlogCategoryList;
