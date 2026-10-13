import React from "react";

const PageHeader = ({ title, description, children, compact = false }) => {
  return (
    <div className={`transition-all duration-300 ${compact ? "mb-4" : "mb-5 md:mb-8"}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        <div>
          <h1
            className={`font-black text-slate-900 leading-tight transition-all duration-300 ${
              compact ? "text-xl" : "text-2xl md:text-3xl"
            }`}
          >
            {title}
          </h1>
          {description && !compact && (
            <p className="text-slate-400 font-medium mt-1 text-sm md:text-base">{description}</p>
          )}
        </div>
        {children && (
          // Phones: one row of actions that scrolls sideways instead of a pile of buttons.
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5 md:flex-wrap md:overflow-visible [&>*]:shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
