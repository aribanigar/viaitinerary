import React from "react";
import { FileText, Loader2 } from "lucide-react";
import Pagination from "./Pagination";

const CompactDataTable = ({
  headers,
  loading,
  hasRows,
  children,
  colSpan,
  loadingText = "Loading...",
  emptyTitle = "No records found",
  emptyDescription = "",
  emptyIcon,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  containerClassName = "border-t border-slate-50",
  tableWrapClassName = "overflow-x-auto",
  tbodyClassName = "divide-y divide-slate-50 text-xs font-medium [&_td]:!px-4 [&_td]:!py-3",
}) => {
  const resolvedColSpan = colSpan || headers.length;
  const resolvedPageSize =
    pagination?.perPage ?? pagination?.per_page ?? pagination?.pageSize;

  return (
    <div className={containerClassName}>
      <div className={tableWrapClassName}>
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {headers.map((header, index) => {
                const label =
                  typeof header === "string" ? header : header.label;
                const className =
                  typeof header === "string" ? "" : (header.className ?? "");

                return (
                  <th
                    key={`${label}-${index}`}
                    className={`px-4 py-3 text-[9px] font-black uppercase tracking-wider text-slate-400 ${className}`}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className={tbodyClassName}>
            {loading ? (
              <tr>
                <td
                  colSpan={resolvedColSpan}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                    </div>
                    <div className="font-bold text-slate-900">
                      {loadingText}
                    </div>
                  </div>
                </td>
              </tr>
            ) : hasRows ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={resolvedColSpan}
                  className="px-4 py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-4 text-slate-300">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
                      {emptyIcon || <FileText className="w-8 h-8" />}
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900">
                        {emptyTitle}
                      </div>
                      {emptyDescription ? (
                        <p className="text-slate-400 text-xs">
                          {emptyDescription}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && onPageChange ? (
        <Pagination
          currentPage={pagination.currentPage}
          lastPage={pagination.lastPage}
          total={pagination.total}
          from={pagination.from}
          to={pagination.to}
          onPageChange={onPageChange}
          pageSize={resolvedPageSize}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={pageSizeOptions}
        />
      ) : null}
    </div>
  );
};

export default CompactDataTable;
