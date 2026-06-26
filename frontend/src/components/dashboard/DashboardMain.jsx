import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import {
  IndianRupee,
  Briefcase,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchTrips } from "../../api/trips";
import { getTeams } from "../../api/teams";
import Loader from "../common/Loader";
import Modal from "../common/Modal";
import SuperAdminDashboard from "./SuperAdminDashboard";

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
      color: "text-emerald-500",
      bgColor: "bg-emerald-500",
      changeColor: "text-slate-400",
      link: "/dashboard/trips?filter=revenue",
    },
    {
      label: "Total Trips",
      value: totalTrips.toString(),
      change: `${totalTrips} itineraries created`,
      icon: Briefcase,
      color: "text-blue-500",
      bgColor: "bg-blue-500",
      changeColor: "text-blue-400",
      link: "/dashboard/trips?filter=total",
    },
    {
      label: "Confirmed Trips",
      value: confirmedTrips.toString(),
      change: "Ready to go",
      icon: CheckCircle2,
      color: "text-purple-500",
      bgColor: "bg-purple-500",
      changeColor: "text-slate-400",
      link: "/dashboard/trips?filter=confirmed",
    },
    {
      label: "Completed Trips",
      value: completedTrips.toString(),
      change: "Successfully finalized",
      icon: CheckCircle2,
      color: "text-orange-500",
      bgColor: "bg-orange-500",
      changeColor: "text-slate-400",
      link: "/dashboard/trips?filter=completed",
    },
  ];

  // If user is super admin, render super admin dashboard
  if (user?.role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 leading-tight">
          Dashboard
        </h1>
        <p className="text-slate-400 font-medium mt-1">
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
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 no-underline group block"
              >
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={`${stat.bgColor} w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-200 group-hover:text-blue-500 transition-colors" />
                </div>
                <div>
                  <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
                    {stat.label}
                  </h3>
                  <p className="text-2xl font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                Ongoing Trips
              </h3>
              <Link
                to="/my-trips"
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:gap-2 transition-all no-underline"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
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
                        className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer no-underline"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-white group-hover:border-blue-100 transition-colors overflow-hidden">
                            {trip.image_url || trip.image ? (
                              <img
                                src={trip.image_url || trip.image}
                                alt={trip.trip_title || trip.tripTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Briefcase className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 mb-0.5">
                              {trip.trip_title ||
                                trip.tripTitle ||
                                "Unnamed Trip"}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                              {trip.client_name ||
                                trip.clientName ||
                                "Unknown Client"}{" "}
                              • {parseInt(trip.duration || 0) + 1} Days
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900 mb-0.5 uppercase">
                            {trip.currency?.split(" ")[0] || "INR"}{" "}
                            {parseFloat(trip.cost || 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            {trip.status || "Draft"}
                          </p>
                        </div>
                      </Link>
                    ))
                ) : (
                  <div className="p-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                    No trips starting today.
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Upcoming Trips Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                Upcoming Trips (Next 7 Days)
              </h3>
              <Link
                to="/my-trips"
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1.5 hover:gap-2 transition-all no-underline"
              >
                View All
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
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
                        className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer no-underline"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-white group-hover:border-blue-100 transition-colors overflow-hidden">
                            {trip.image_url || trip.image ? (
                              <img
                                src={trip.image_url || trip.image}
                                alt={trip.trip_title || trip.tripTitle}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Briefcase className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 mb-0.5">
                              {trip.trip_title ||
                                trip.tripTitle ||
                                "Unnamed Trip"}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">
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
                          <p className="text-sm font-black text-slate-900 mb-0.5 uppercase">
                            {trip.currency?.split(" ")[0] || "INR"}{" "}
                            {parseFloat(trip.cost || 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                            {trip.status || "Draft"}
                          </p>
                        </div>
                      </Link>
                    ))
                ) : (
                  <div className="p-10 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                    No trips scheduled for the next 7 days.
                  </div>
                );
              })()}
            </div>
          </div>
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
    </DashboardLayout>
  );
};

export default DashboardMain;
