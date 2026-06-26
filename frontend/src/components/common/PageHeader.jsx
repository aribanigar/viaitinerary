import React from "react";

const PageHeader = ({ title, description, children }) => {
  return (
    <div className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 leading-tight">
            {title}
          </h1>
          {description && (
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
