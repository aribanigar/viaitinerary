import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import { Package, Plus, Edit3, Trash2, Play, Lock, MapPin, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { fetchPackages, deletePackage, usePackage } from "../../api/packages";
import Loader from "../common/Loader";

const Packages = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [useTarget, setUseTarget] = useState(null); // package being instantiated
  const [client, setClient] = useState({ client_name: "", client_email: "", client_phone: "", start_date: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchPackages(token);
      setPackages(res.data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Delete package "${pkg.trip_title}"? This cannot be undone.`)) return;
    try {
      await deletePackage(token, pkg.package_id);
      setPackages((prev) => prev.filter((p) => p.package_id !== pkg.package_id));
      toast.success("Package deleted");
    } catch (err) {
      toast.error(err.message || "Failed to delete package");
    }
  };

  const submitUse = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await usePackage(token, useTarget.package_id, client);
      toast.success("Trip created from package");
      const tripId = res.trip_id || (res.trip && res.trip.trip_id);
      setUseTarget(null);
      setClient({ client_name: "", client_email: "", client_phone: "", start_date: "" });
      if (tripId) navigate(`/trip-builder/${tripId}`);
    } catch (err) {
      toast.error(err.message || "Failed to create trip from package");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1c1c] flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" /> Packages
            </h1>
            <p className="text-slate-500 text-sm mt-1">Reusable templates — build once, quote clients in seconds.</p>
          </div>
          <button
            onClick={() => navigate("/package-builder")}
            className="bg-[#c7f135] hover:bg-[#b0dc00] text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Package
          </button>
        </div>

        {loading ? (
          <Loader />
        ) : packages.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No packages yet.</p>
            <button onClick={() => navigate("/package-builder")} className="mt-4 text-blue-600 font-semibold text-sm">
              + Create your first package
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <div key={pkg.package_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                {pkg.image_url ? (
                  <img src={pkg.image_url} alt={pkg.trip_title} className="h-32 w-full object-cover" />
                ) : (
                  <div className="h-32 w-full bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
                    <Package className="w-10 h-10 text-blue-200" />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-slate-800 leading-tight">{pkg.trip_title}</h3>
                    {pkg.locked && (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {pkg.destination || "—"} · {pkg.duration ? `${pkg.duration} days` : "—"}
                  </p>
                  <p className="text-sm font-semibold text-slate-700 mt-2">
                    {pkg.currency_symbol || ""}
                    {pkg.cost != null ? Number(pkg.cost).toLocaleString("en-IN") : "—"}
                  </p>
                  <div className="mt-auto pt-4 flex gap-1.5">
                    <button
                      onClick={() => setUseTarget(pkg)}
                      className="flex-1 bg-[#c7f135] hover:bg-[#b0dc00] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" /> Use
                    </button>
                    <button
                      onClick={() => navigate(`/package-builder/${pkg.package_id}`)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(pkg)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-100 text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {useTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setUseTarget(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-[#1a1c1c]">Create trip from package</h2>
            <p className="text-sm text-slate-500 mb-4">{useTarget.trip_title}</p>
            <form onSubmit={submitUse} className="space-y-3">
              <input
                required
                placeholder="Client name"
                value={client.client_name}
                onChange={(e) => setClient({ ...client, client_name: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Client email"
                value={client.client_email}
                onChange={(e) => setClient({ ...client, client_email: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Client phone"
                value={client.client_phone}
                onChange={(e) => setClient({ ...client, client_phone: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={client.start_date}
                onChange={(e) => setClient({ ...client, start_date: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#c7f135] hover:bg-[#b0dc00] text-white py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Create trip
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Packages;
