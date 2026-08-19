import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AssistantFrame from "./AssistantFrame";
import {
  IndianRupee,
  Briefcase,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Plus,
  Inbox,
  Package,
  BarChart3,
  Hotel,
  Car,
  MapPin,
  ShieldCheck,
  FileText,
  BookOpen,
  CreditCard,
  Zap,
  Type,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTrips } from "../../api/trips";
import { getTeams } from "../../api/teams";
import Loader from "../common/Loader";
import Modal from "../common/Modal";
import SuperAdminDashboard from "./SuperAdminDashboard";

// Quick-access destinations that used to live only in the sidebar's nested
// Operations / Resources / Accounting submenus. Surfaced here as tiles since
// the AssistantFrame shell's rail only carries the five primary sections.
const QUICK_ACCESS = [
  { label: "Lead Inquiries", to: "/lead-inquiries", icon: Inbox, roles: ["admin", "team"] },
  { label: "Packages", to: "/packages", icon: Package, roles: ["admin", "team"] },
  { label: "Team Reports", to: "/team-report", icon: BarChart3, roles: ["admin"] },
  { label: "Accommodation", to: "/accommodation", icon: Hotel, roles: ["admin", "team"] },
  { label: "Transportation", to: "/transportation", icon: Car, roles: ["admin", "team"] },
  { label: "Destinations", to: "/destinations", icon: MapPin, roles: ["admin", "team"] },
  { label: "Policies", to: "/policies", icon: ShieldCheck, roles: ["admin"] },
  { label: "Voucher Desk", to: "/accounting", icon: FileText, roles: ["admin"] },
  { label: "Ledger", to: "/ledger", icon: BookOpen, roles: ["admin"] },
  { label: "Bank Details", to: "/payment-details", icon: CreditCard, roles: ["admin"] },
  { label: "Subscription", to: "/subscription", icon: Zap, roles: ["admin"] },
  { label: "Branding", to: "/typography", icon: Type, roles: ["admin"] },
];

const DashboardMain = () => {
  const { token, user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOffer, setShowOffer] = useState(false);
  const [offerData, setOfferData] = useState(null);

  useEffect(() => {
    async function checkOffer() {
      if (!token || !user || user.role === "superadmin") return;

      try {
        const API_URL =
          import.meta.env.VITE_API_URL || "http://localhost:8000/api";
        const resp = await fetch(`${API_URL}/subscription/status`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });
        const data = await resp.json();

        if (resp.ok && data.active_offer) {
          setOfferData(data.active_offer);
          setShowOffer(true);
        }
      } catch (err) {
        console.error("Failed to check for offers:", err);
      }
    }

    if (token) checkOffer();
  }, [token, user]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [tripsResp, teamsResp] = await Promise.all([
          fetchTrips(token, { per_page: 1000 }),
          getTeams(token),
        ]);
        setTrips(tripsResp.data || []);
        setTeamMembers(teamsResp || []);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    if (token) loadDashboardData();
  }, [token]);

  const totalTrips = trips.length;
  // Total Revenue = sum of paid_amount across all itineraries/trips (regardless of status)
  const totalRevenue = trips.reduce(
    (sum, t) => sum + (parseFloat(t.paid_amount) || 0),
    0,
  );
  const totalTeam = teamMembers.length;
  const confirmedTrips = trips.filter(
    (t) => t.status?.toLowerCase() === "confirmed",
  ).length;
  const completedTrips = trips.filter(
    (t) => t.status?.toLowerCase() === "completed",
  ).length;

  const stats = [
    {
      label: "Total Revenue",
      value: `INR ₹${totalRevenue.toLocaleString()}`,
      change: `${totalTrips} total items`,
      icon: IndianRupee,
      bgColor: "bg-[#e7f63c]",
      iconColor: "text-[#181c22]",
      changeColor: "text-[#9aa3b2]",
      link: "/dashboard/trips?filter=revenue",
    },
    {
      label: "Total Trips",
      value: totalTrips.toString(),
      change: `${totalTrips} itineraries created`,
      icon: Briefcase,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
      changeColor: "text-[#9aa3b2]",
      link: "/dashboard/trips?filter=total",
    },
    {
      label: "Confirmed Trips",
      value: confirmedTrips.toString(),
      change: "Ready to go",
      icon: CheckCircle2,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
      changeColor: "text-[#9aa3b2]",
      link: "/dashboard/trips?filter=confirmed",
    },
    {
      label: "Completed Trips",
      value: completedTrips.toString(),
      change: "Successfully finalized",
      icon: CheckCircle2,
      bgColor: "bg-[#181c22]",
      iconColor: "text-white",
      changeColor: "text-[#9aa3b2]",
      link: "/dashboard/trips?filter=completed",
    },
  ];

  // If user is super admin, render super admin dashboard
  if (user?.role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  const quickAccess = QUICK_ACCESS.filter((item) =>
    item.roles.includes(user?.role),
  );

  return (
    <AssistantFrame
      title="Dashboard"
      actions={
        <Link
          to="/trip-builder"
          className="px-4 py-2 rounded-full text-xs font-semibold bg-[#e7f63c] text-[#181c22] hover:bg-[#d4e42e] transition-colors flex items-center gap-1.5 shadow-sm shadow-[#e7f63c]/40"
        >
          <Plus className="w-3.5 h-3.5" /> Create a Trip
        </Link>
      }
    >
      <div className="h-full overflow-y-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-[#181c22] leading-tight">
              Dashboard
            </h1>
            <p className="text-[#8a93a2] font-medium mt-1">
              Welcome back! Here's what's happening today.
            </p>
          </div>

          {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader text="Loading dashboard metrics..." />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, i) => (
              <Link
                key={i}
                to={stat.link}
                className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 no-underline group block"
              >
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={`${stat.bgColor} w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#cdd2da] group-hover:text-blue-500 transition-colors" />
                </div>
                <div>
                  <h3 className="text-[#8a93a2] text-[10px] font-bold uppercase tracking-widest mb-1">
                    {stat.label}
                  </h3>
                  <p className="text-2xl font-bold text-[#181c22] mb-2 group-hover:text-blue-600 transition-colors">
                    {stat.value}
                  </p>
                  <p className={`text-[10px] font-bold ${stat.changeColor}`}>
                    {stat.change}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Today's Trips Card */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-black/5 flex flex-wrap gap-2 justify-between items-center bg-[#f3f3f4]/60">
              <h3 className="text-sm font-bold text-[#181c22] uppercase tracking-widest">
                Ongoing Trips
              </h3>
              <Link
                to="/my-trips"
                className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:gap-2 transition-all no-underline"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-black/5">
              {(() => {
                const today = new Date().toISOString().split("T")[0];
                const todaysTrips = trips.filter(
                  (trip) => trip.start_date === today,
                );
                return todaysTrips.length > 0 ? (
                  todaysTrips
                    .sort(
                      (a, b) =>
                        new Date(b.updated_at || b.lastModified || 0) -
                        new Date(a.updated_at || a.lastModified || 0),
                    )
                    .map((trip) => (
                      <Link
                        key={trip.trip_id || trip.tripId}
                        to={`/trip-builder/${trip.trip_id || trip.tripId}`}
                        className="p-6 flex items-center justify-between hover:bg-black/[0.02] transition-colors group cursor-pointer no-underline"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-[#f3f3f4] rounded-xl flex items-center justify-center border border-black/5 group-hover:bg-white group-hover:border-black/10 transition-colors overflow-hidden">
                            {trip.image_url || trip.image ? (
                              <img
                                src={trip.image_url || trip.image}
                                alt={trip.trip_title || trip.tripTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Briefcase className="w-5 h-5 text-[#8a93a2] group-hover:text-blue-500 transition-colors" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#181c22] mb-0.5">
                              {trip.trip_title ||
                                trip.tripTitle ||
                                "Unnamed Trip"}
                            </h4>
                            <p className="text-[11px] text-[#8a93a2] font-bold uppercase tracking-tight">
                              {trip.client_name ||
                                trip.clientName ||
                                "Unknown Client"}{" "}
                              • {parseInt(trip.duration || 0) + 1} Days
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#181c22] mb-0.5 uppercase">
                            {trip.currency?.split(" ")[0] || "INR"}{" "}
                            {parseFloat(trip.cost || 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[#8a93a2] font-bold uppercase tracking-tight">
                            {trip.status || "Draft"}
                          </p>
                        </div>
                      </Link>
                    ))
                ) : (
                  <div className="p-10 text-center text-[#8a93a2] font-bold text-xs uppercase tracking-widest">
                    No trips starting today.
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Upcoming Trips Card */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-black/5 flex flex-wrap gap-2 justify-between items-center bg-[#f3f3f4]/60">
              <h3 className="text-sm font-bold text-[#181c22] uppercase tracking-widest">
                Upcoming Trips (Next 7 Days)
              </h3>
              <Link
                to="/my-trips"
                className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:gap-2 transition-all no-underline"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-black/5">
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);

                const upcomingTrips = trips.filter((trip) => {
                  if (!trip.start_date) return false;
                  const startDate = new Date(trip.start_date);
                  startDate.setHours(0, 0, 0, 0);
                  // Trips starting strictly after today and within next 7 days
                  return startDate > today && startDate <= nextWeek;
                });

                return upcomingTrips.length > 0 ? (
                  upcomingTrips
                    .sort(
                      (a, b) => new Date(a.start_date) - new Date(b.start_date),
                    )
                    .map((trip) => (
                      <Link
                        key={trip.trip_id || trip.tripId}
                        to={`/trip-builder/${trip.trip_id || trip.tripId}`}
                        className="p-6 flex items-center justify-between hover:bg-black/[0.02] transition-colors group cursor-pointer no-underline"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-[#f3f3f4] rounded-xl flex items-center justify-center border border-black/5 group-hover:bg-white group-hover:border-black/10 transition-colors overflow-hidden">
                            {trip.image_url || trip.image ? (
                              <img
                                src={trip.image_url || trip.image}
                                alt={trip.trip_title || trip.tripTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Briefcase className="w-5 h-5 text-[#8a93a2] group-hover:text-blue-500 transition-colors" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#181c22] mb-0.5">
                              {trip.trip_title ||
                                trip.tripTitle ||
                                "Unnamed Trip"}
                            </h4>
                            <p className="text-[11px] text-[#8a93a2] font-bold uppercase tracking-tight">
                              {trip.client_name ||
                                trip.clientName ||
                                "Unknown Client"}{" "}
                              • {parseInt(trip.duration || 0) + 1} Days •{" "}
                              {new Date(trip.start_date).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-[#181c22] mb-0.5 uppercase">
                            {trip.currency?.split(" ")[0] || "INR"}{" "}
                            {parseFloat(trip.cost || 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-[#8a93a2] font-bold uppercase tracking-tight">
                            {trip.status || "Draft"}
                          </p>
                        </div>
                      </Link>
                    ))
                ) : (
                  <div className="p-10 text-center text-[#8a93a2] font-bold text-xs uppercase tracking-widest">
                    No trips scheduled for the next 7 days.
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Quick Access */}
          {quickAccess.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-bold text-[#181c22] uppercase tracking-widest mb-4">
                Quick Access
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickAccess.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 no-underline group flex flex-col items-center text-center gap-2"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#f3f3f4] group-hover:bg-[#e7f63c] flex items-center justify-center transition-colors">
                      <item.icon className="w-5 h-5 text-[#181c22]" />
                    </div>
                    <span className="text-[11px] font-semibold text-[#181c22]/80 leading-tight">
                      {item.label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Offer Popup Modal */}
      {showOffer && offerData && (
        <Modal
          isOpen={showOffer}
          onClose={() => setShowOffer(false)}
          title={offerData.name}
          pureContent={true}
        >
          {offerData.offer_image && (
            <a
              href="/subscription"
              onClick={(e) => {
                e.preventDefault();
                setShowOffer(false);
                window.location.href = "/subscription";
              }}
              className="block overflow-hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-[1.01] transition-transform duration-300"
            >
              <img
                src={offerData.offer_image}
                alt="Special Offer"
                className="w-full h-auto object-cover"
              />
            </a>
          )}
        </Modal>
      )}
        </div>
      </div>
    </AssistantFrame>
  );
};

export default DashboardMain;
