import React, { useState, useEffect } from "react";
import DashboardLayout from "./DashboardLayout";
import {
  Calculator as CalculatorIcon,
  Plus,
  Edit2,
  Loader2,
  Trash2,
  Download,
  Mail,
  Phone,
} from "lucide-react";
import {
  getCalculations,
  deleteCalculation,
  downloadCalculationPdf,
} from "../../api/calculations";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const CalculatorList = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [calculations, setCalculations] = useState([]);

  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        const calcResp = await getCalculations(token);
        setCalculations(calcResp.data || []);
      } catch (error) {
        toast.error("Failed to load calculations");
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchList();
  }, [token]);

  const handleDeleteCalculation = async (id) => {
    if (!window.confirm("Are you sure you want to delete this calculation?"))
      return;

    try {
      await deleteCalculation(token, id);
      setCalculations(calculations.filter((c) => c.id !== id));
      toast.success("Calculation deleted");
    } catch (error) {
      toast.error("Failed to delete");
    }
  };

  const downloadPdf = async (calc) => {
    try {
      setDownloadingId(calc.id);
      const blob = await downloadCalculationPdf(token, calc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Pricing-Sheet-${calc.client_name || "Estimate"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">
              Cost Calculator
            </h1>
            <p className="text-slate-400 font-medium mt-1">
              Estimate your trip costs with accommodation and transportation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/calculator/create")}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all text-sm w-fit shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              New Calculation
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Client Name
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Created By
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Total Cost
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Date
                </th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-[2rem] bg-slate-50 flex items-center justify-center mx-auto">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                      <div className="font-bold text-slate-900">
                        Loading calculations...
                      </div>
                    </div>
                  </td>
                </tr>
              ) : calculations.length > 0 ? (
                calculations.map((calc) => (
                  <tr
                    key={calc.id}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold text-slate-900">
                        {calc.client_name}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase">
                            {calc.user?.name?.charAt(0) || "U"}
                          </div>
                          <span className="text-sm font-bold text-slate-900">
                            {calc.user?.name}
                          </span>
                        </div>
                        {calc.user?.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail className="w-3 h-3" />
                            {calc.user.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-900">
                        ₹{parseFloat(calc.total_cost).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-medium text-slate-400">
                        {new Date(calc.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            navigate(`/calculator/edit/${calc.id}`)
                          }
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Edit / Reuse"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadPdf(calc)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all disabled:opacity-50"
                          title="Download PDF"
                          disabled={downloadingId === calc.id}
                        >
                          {downloadingId === calc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteCalculation(calc.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
                  <td colSpan="5" className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
                        <CalculatorIcon className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        No calculations found
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Start by creating your first trip estimate.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CalculatorList;
