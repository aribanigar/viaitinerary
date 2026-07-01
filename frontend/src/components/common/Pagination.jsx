import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const Pagination = ({
  currentPage,
  lastPage,
  onPageChange,
  total,
  from,
  to,
  pageSize = 25,
  pageSizeOptions = [25, 50, 100, 250, 500],
  onPageSizeChange,
}) => {
  const showPageSize = typeof onPageSizeChange === "function";
  if (lastPage <= 1 && total === 0 && !showPageSize) return null;

  const resolvedPageSize = pageSizeOptions.includes(pageSize)
    ? pageSize
    : pageSizeOptions[0];

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-50">
      <div className="flex flex-1 items-center justify-between gap-3 sm:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === lastPage}
            className="relative inline-flex items-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-all text-[10px] font-black uppercase tracking-widest"
          >
            Next
          </button>
        </div>
        {showPageSize ? (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Rows
            </span>
            <select
              value={resolvedPageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Showing <span className="text-slate-900">{from || 0}</span> to{" "}
            <span className="text-slate-900">{to || 0}</span> of{" "}
            <span className="text-slate-900">{total}</span> results
          </p>
          {showPageSize ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Rows
              </span>
              <select
                value={resolvedPageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
        <div>
          <nav
            className="isolate inline-flex -space-x-px rounded-xl shadow-sm gap-2"
            aria-label="Pagination"
          >
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center rounded-xl p-2 text-slate-400 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 transition-all border border-slate-100"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(lastPage)].map((_, i) => {
                const page = i + 1;
                // Limit shown pages if lastPage is large
                if (lastPage > 7) {
                  if (
                    page !== 1 &&
                    page !== lastPage &&
                    (page < currentPage - 1 || page > currentPage + 1)
                  ) {
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-2 text-slate-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }
                }
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`relative inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                      currentPage === page
                        ? "bg-[#c7f135] text-[#10182a] shadow-lg shadow-[#c7f135]/40"
                        : "text-slate-400 hover:bg-slate-50 border border-transparent hover:border-slate-100"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === lastPage}
              className="relative inline-flex items-center rounded-xl p-2 text-slate-400 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 transition-all border border-slate-100"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
