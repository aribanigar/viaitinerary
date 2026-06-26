import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import Modal from "../common/Modal";
import {
  Plus,
  Upload,
  Building2,
  Trash2,
  Pencil,
  Search,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const SuperAdminTrustedCompanies = () => {
  const { token } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  const [formData, setFormData] = useState({
    name: "",
    is_active: true,
    logo: null,
  });

  const [previewUrl, setPreviewUrl] = useState(null);

  const loadCompanies = async (page = 1) => {
    try {
      setLoading(true);
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const url = `${apiUrl}/trusted-companies-admin?page=${page}&per_page=${pageSize}&search=${searchQuery}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to load companies");

      const data = await response.json();
      setCompanies(data.data);
      setPagination({
        currentPage: data.current_page,
        lastPage: data.last_page,
        total: data.total,
        from: data.from,
        to: data.to,
        perPage: data.per_page,
      });
    } catch (error) {
      console.error("Error loading companies:", error);
      toast.error(error.message || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadCompanies(1);
  }, [token, pageSize]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (token) loadCompanies(1);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File size should be less than 2MB");
        return;
      }
      setFormData((prev) => ({ ...prev, logo: file }));
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleEdit = (company) => {
    setEditingId(company.id);
    setFormData({
      name: company.name,
      is_active: company.is_active,
      logo: null,
    });
    setPreviewUrl(formatImageUrl(company.logo_path));
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this company?"))
      return;

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const response = await fetch(`${apiUrl}/trusted-companies-admin/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete company");

      toast.success("Company deleted successfully");
      loadCompanies(pagination.currentPage);
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error(error.message || "Failed to delete company");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const data = new FormData();
    data.append("name", formData.name);
    data.append("is_active", formData.is_active ? "1" : "0");
    if (formData.logo) {
      data.append("logo", formData.logo);
    }

    if (editingId) {
      data.append("_method", "PUT");
    }

    try {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const url = editingId
        ? `${apiUrl}/trusted-companies-admin/${editingId}`
        : `${apiUrl}/trusted-companies-admin`;

      const response = await fetch(url, {
        method: "POST",
        body: data,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save company");
      }

      toast.success(
        editingId
          ? "Company updated successfully"
          : "Company added successfully",
      );
      setIsModalOpen(false);
      resetForm();
      loadCompanies(editingId ? pagination.currentPage : 1);
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(error.message || "Failed to save company");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", is_active: true, logo: null });
    setPreviewUrl(null);
    setEditingId(null);
  };

  const formatImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:8000/api"
    ).replace(/\/$/, "");
    return `${apiBase}/storage/${path}`;
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Trusted Companies
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage logos for the "Trusted By" landing page section.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: "", is_active: true, logo: null });
              setPreviewUrl(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Add New Company
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Company Details" },
            { label: "Status" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading companies..."
          hasRows={filteredCompanies.length > 0}
          emptyIcon={<Building2 className="w-8 h-8" />}
          emptyTitle="No companies found"
          emptyDescription={
            searchQuery
              ? "Try a different search term or add a new company."
              : "Start by adding your first trusted company."
          }
          pagination={pagination}
          onPageChange={loadCompanies}
          onPageSizeChange={handlePageSizeChange}
        >
          {filteredCompanies.map((company) => (
            <tr
              key={company.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden">
                    {company.logo_path ? (
                      <img
                        src={formatImageUrl(company.logo_path)}
                        alt={company.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <Building2 className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      {company.name}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                {company.is_active ? (
                  <span className="px-2.5 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-lg uppercase tracking-wider border border-green-100">
                    Active
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                    Inactive
                  </span>
                )}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => handleEdit(company)}
                    className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(company.id)}
                    className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </CompactDataTable>
      </div>

      {/* Add/Edit Company Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
          resetForm();
        }}
        title="Company"
        isEditing={!!editingId}
        onSubmit={handleSubmit}
        submitButtonText="Save Company"
        submitting={submitting}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Company Name
            </label>
            <div className="relative group">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
                placeholder="e.g. Acme Corporation"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
              Company Logo
            </label>
            <div className="relative group">
              <div className="w-full h-32 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors cursor-pointer relative overflow-hidden">
                {previewUrl ? (
                  <>
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-contain p-4"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Upload Company Logo
                    </span>
                  </>
                )}
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".jpg,.jpeg,.png,.webp"
                />
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 ml-1">
              JPG, JPEG, PNG, WebP (MAX 2MB)
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                Visibility
              </label>
              <p className="text-xs text-slate-500 font-medium">
                Show on landing page ticker
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
};

export default SuperAdminTrustedCompanies;
