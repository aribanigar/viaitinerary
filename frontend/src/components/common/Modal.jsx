import React from "react";
import { X, Loader2 } from "lucide-react";

const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  submitButtonText = "Save",
  onSubmit,
  isEditing = false,
  submitting = false,
  hideFooter = false,
  pureContent = false,
}) => {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  if (pureContent) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-8">
        <div className="relative w-full max-w-lg animate-in fade-in zoom-in duration-300">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-red-400 transition-colors bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-md z-50 border border-white/20"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="bg-transparent overflow-hidden rounded-[2.5rem]">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 flex-shrink-0">
          <h2 className="text-xl font-black text-slate-900">
            {isEditing ? `Edit ${title}` : `Add ${title}`}
          </h2>
          <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
            {isEditing ? "Update Details" : `${title} Details`}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 flex-grow flex flex-col min-h-0"
        >
          <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar">
            {children}
          </div>

          {!hideFooter && (
            <div className="flex-shrink-0 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#1a1c1c] text-white py-4 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>
                    {isEditing ? `Update ${title}` : submitButtonText}
                  </span>
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Modal;
