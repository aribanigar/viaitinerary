import React from "react";
import { X, AlertTriangle, Loader2 } from "lucide-react";

/**
 * A standard confirmation modal for delete and other critical actions
 */
const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed? This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  type = "danger", // 'danger' | 'warning'
  loading = false,
}) => {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-red-500" />,
      iconBg: "bg-red-50",
      buttonBg: "bg-red-500 hover:bg-red-600",
      shadow: "shadow-red-500/20",
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
      iconBg: "bg-amber-50",
      buttonBg: "bg-amber-500 hover:bg-amber-600",
      shadow: "shadow-amber-500/20",
    },
  }[type];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div
        className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className={`w-14 h-14 ${typeConfig.iconBg} rounded-[1.5rem] flex items-center justify-center mb-5`}
          >
            {typeConfig.icon}
          </div>

          <h3 className="text-lg font-black text-slate-900 mb-2">{title}</h3>
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
            {message}
          </p>

          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-3.5 bg-slate-50 text-slate-400 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-6 py-3.5 ${typeConfig.buttonBg} text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg ${typeConfig.shadow} hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>{confirmText}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
