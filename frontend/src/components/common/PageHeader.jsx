import React from "react";

const PageHeader = ({ title, description, children, compact = false }) => {
  return (
    <div className={`transition-all duration-300 ${compact ? "mb-4" : "mb-8"}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1
            className={`font-black text-slate-900 leading-tight transition-all duration-300 ${
              compact ? "text-xl" : "text-3xl"
            }`}
          >
            {title}
          </h1>
          {description && !compact && (
            <p className="text-slate-400 font-medium mt-1">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-3">{children}</div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
