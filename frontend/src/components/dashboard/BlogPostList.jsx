import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  PenTool,
  Calendar,
  Edit2,
  Eye,
  Plus,
  Trash2,
  Search,
  Loader2,
  Filter,
  Tag,
  ExternalLink,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import CompactDataTable from "../common/CompactDataTable";

const BlogPostList = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  const loadPosts = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: pageSize.toString(),
      });
      if (statusFilter) params.append("status", statusFilter);
      if (categoryFilter) params.append("category_id", categoryFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/posts?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }

      const data = await response.json();
      setPosts(data.data || []);
      setPagination({
        currentPage: data.current_page,
        lastPage: data.last_page,
        total: data.total,
        from: data.from,
        to: data.to,
        perPage: data.per_page ?? pageSize,
      });
    } catch (err) {
      console.error("Failed to load posts:", err);
      toast.error(err.message || "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    if (token) {
      loadPosts(1);
      loadCategories();
    }
  }, [token, statusFilter, categoryFilter, searchQuery, pageSize]);

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setPagination((prev) => ({ ...prev, perPage: value }));
  };

  const handleDelete = async (postId) => {
    if (window.confirm("Are you sure you want to delete this blog post?")) {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/posts/${postId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to delete post");
        }

        toast.success("Blog post deleted successfully!");
        loadPosts(pagination.currentPage);
      } catch (err) {
        toast.error(err.message || "Failed to delete blog post");
      }
    }
  };

  const togglePublishStatus = async (post) => {
    try {
      const endpoint = post.status === "published" ? "unpublish" : "publish";
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/super-admin/blog/posts/${post.id}/${endpoint}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} post`);
      }

      const data = await response.json();
      toast.success(
        `Post ${post.status === "published" ? "unpublished" : "published"} successfully!`,
      );
      loadPosts(pagination.currentPage);
    } catch (err) {
      toast.error(err.message || "Failed to update post status");
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: "bg-gray-100 text-gray-800",
      published: "bg-green-100 text-green-800",
      scheduled: "bg-blue-100 text-blue-800",
      archived: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.draft}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Blog Posts
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Manage your blog content and SEO
            </p>
          </div>
          <Link
            to="/admin/blog/posts/new"
            className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
          >
            <Plus className="w-4 h-4" />
            Create New Post
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 md:w-40 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 md:w-40 px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <CompactDataTable
          headers={[
            { label: "Post Details" },
            { label: "Category" },
            { label: "Stats", className: "text-center" },
            { label: "Status", className: "text-center" },
            { label: "Actions", className: "text-right" },
          ]}
          loading={loading}
          loadingText="Loading blog posts..."
          hasRows={posts.length > 0}
          emptyIcon={<PenTool className="w-8 h-8" />}
          emptyTitle="No blog posts found"
          emptyDescription={
            searchQuery
              ? "Try a different search term or filters."
              : "Start by creating your first blog post."
          }
          pagination={pagination}
          onPageChange={loadPosts}
          onPageSizeChange={handlePageSizeChange}
        >
          {posts.map((post) => (
            <tr
              key={post.id}
              className="hover:bg-slate-50/50 group transition-colors"
            >
              <td>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden">
                    {post.featured_image ? (
                      <img
                        src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/storage/${post.featured_image}`}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <PenTool className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 line-clamp-1">
                      {post.title}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {formatDate(post.published_at)}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                  <Tag className="w-3 h-3" />
                  {post.category?.name || "Uncategorized"}
                </div>
              </td>
              <td className="text-center">
                <div className="inline-flex items-center gap-1 font-bold text-blue-600">
                  <Eye className="w-3 h-3" />
                  {post.views_count || 0}
                </div>
              </td>
              <td className="text-center">
                {post.status === "published" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    <Eye className="w-3 h-3" />
                    Published
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-400 text-[10px] font-black rounded-lg uppercase tracking-wider">
                    <EyeOff className="w-3 h-3" />
                    {post.status}
                  </span>
                )}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    to={`/blog/${post.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                    title={
                      post.status === "draft" ? "Preview Draft" : "View Post"
                    }
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  <Link
                    to={`/admin/blog/posts/${post.id}/edit`}
                    className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                    title="Edit Post"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                    title="Delete Post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </CompactDataTable>
      </div>
    </DashboardLayout>
  );
};

export default BlogPostList;
