import React, { useState, useEffect } from "react";
import {
  Bell,
  Check,
  Trash2,
  Phone,
  User,
  Calendar,
  BellOff,
  Search,
  Loader2,
} from "lucide-react";

const WhatsAppIcon = ({ size = 16, className = "" }) => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
    alt="WhatsApp"
    style={{
      width: size,
      height: size,
      display: "inline-block",
      verticalAlign: "middle",
    }}
    className={className}
  />
);
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "../../api/notifications";
import { toast } from "react-toastify";
import DashboardLayout from "./DashboardLayout";
import { useNotifications } from "../../context/NotificationContext";
import Pagination from "../common/Pagination";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unreadCount, setUnreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: 25,
  });

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setTablePage(1);
  };

  const handlePageSizeChange = (value) => {
    setPageSize(value);
    setTablePage(1);
  };

  const loadNotifications = async (page = 1) => {
    try {
      setLoading(true);
      const data = await getNotifications({
        page,
        perPage: pageSize,
        search: searchQuery.trim() || undefined,
      });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count ?? 0);
      if (data.pagination) {
        setPagination({
          currentPage: data.pagination.current_page ?? page,
          lastPage: data.pagination.last_page ?? 1,
          total: data.pagination.total ?? 0,
          from: data.pagination.from ?? 0,
          to: data.pagination.to ?? 0,
          perPage: data.pagination.per_page ?? pageSize,
        });
      } else {
        setPagination({
          currentPage: page,
          lastPage: 1,
          total: data.notifications?.length ?? 0,
          from: data.notifications?.length ? 1 : 0,
          to: data.notifications?.length ?? 0,
          perPage: pageSize,
        });
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications(tablePage);
  }, [tablePage, searchQuery, pageSize]);

  const handleMarkAsRead = async (id) => {
    try {
      await markAsRead(id);
      setNotifications(
        notifications.map((n) =>
          n.id === id ? { ...n, read_at: new Date() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.success("Marked as read");
    } catch (error) {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      setNotifications(
        notifications.map((n) => ({ ...n, read_at: new Date() })),
      );
      setUnreadCount(0);
      toast.success("All marked as read");
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        await deleteNotification(id);
        const deletedNotification = notifications.find((n) => n.id === id);
        if (!deletedNotification.read_at) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        const nextTotal = Math.max(0, pagination.total - 1);
        const perPage = pagination.perPage || pageSize;
        const nextLastPage = Math.max(1, Math.ceil(nextTotal / perPage));
        const nextPage = Math.min(tablePage, nextLastPage);

        if (nextPage !== tablePage) {
          setTablePage(nextPage);
        } else {
          await loadNotifications(nextPage);
        }
        toast.success("Notification deleted");
      } catch (error) {
        toast.error("Failed to delete notification");
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Notifications
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Stay updated with follow-ups and system alerts.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 bg-[#c7f135] text-[#10182a] px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#c7f135]/40 hover:bg-[#b0dc00] transition-all text-sm w-fit"
            >
              <Check className="w-4 h-4" />
              Mark All as Read
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#c7f135]/20 transition-all placeholder:text-slate-300 placeholder:font-medium"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Notification Info
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Related Details
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm font-medium">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-4xl bg-slate-50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                      <div className="font-bold text-slate-900">
                        Loading notifications...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : notifications.length > 0 ? (
                notifications.map((notification) => (
                  <tr
                    key={notification.id}
                    className={`hover:bg-slate-50/50 group transition-colors ${
                      notification.read_at ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                            notification.read_at
                              ? "bg-slate-100 text-slate-400"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          <Bell className="w-6 h-6" />
                        </div>
                        <div>
                          <div
                            className={`font-bold text-slate-900 ${
                              notification.read_at ? "" : "text-blue-600"
                            }`}
                          >
                            {notification.data.message}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {new Date(
                              notification.created_at,
                            ).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(
                              notification.created_at,
                            ).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {notification.data.type === "follow_up" && (
                        <div className="flex flex-wrap gap-2">
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {notification.data.client_name}
                          </span>
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            ID: {notification.data.trip_id}
                          </span>
                          {notification.data.client_phone && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {notification.data.client_phone}
                            </span>
                          )}
                        </div>
                      )}
                      {(notification.data.type === "new_lead" ||
                        notification.data.type === "lead_assigned") && (
                        <div className="flex flex-wrap gap-2">
                          {notification.data.client_name && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {notification.data.client_name}
                            </span>
                          )}
                          {notification.data.inquiry_id && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              ID: {notification.data.inquiry_id}
                            </span>
                          )}
                          {notification.data.client_phone && (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {notification.data.client_phone}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(notification.data.type === "follow_up" ||
                          notification.data.type === "new_lead" ||
                          notification.data.type === "lead_assigned") &&
                          notification.data.client_phone && (
                            <a
                              href={`https://wa.me/${notification.data.client_phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-green-50 text-[#25D366] hover:text-[#128C7E] rounded-xl transition-all"
                              title="Message on WhatsApp"
                            >
                              <WhatsAppIcon size={16} />
                            </a>
                          )}
                        {!notification.read_at && (
                          <button
                            onClick={() => handleMarkAsRead(notification.id)}
                            className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-600 rounded-xl transition-all"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-600 rounded-xl transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-[2.5rem] bg-slate-50 flex items-center justify-center text-slate-300">
                        <BellOff className="w-10 h-10" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900">
                          No notifications found
                        </div>
                        <p className="text-slate-400 text-xs">
                          {searchQuery
                            ? "Try a different search term."
                            : "You're all caught up! No notifications yet."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          from={pagination.from}
          to={pagination.to}
          onPageChange={setTablePage}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
