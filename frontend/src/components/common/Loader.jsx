import React from "react";
import { Loader2 } from "lucide-react";

const Loader = ({
  fullPage = false,
  inline = false,
  size = "md",
  text = "Loading...",
  color = "text-blue-600",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const content = (
    <div
      className={`flex ${inline ? "flex-row" : "flex-col"} items-center justify-center gap-3`}
    >
      <Loader2
        className={`${sizeClasses[size] || sizeClasses.md} ${color} animate-spin`}
      />
      {text && (
        <p className="text-slate-500 font-medium animate-pulse">{text}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        {content}
      </div>
    );
  }

  if (inline) {
    return content;
  }

  return (
    <div className="p-8 flex items-center justify-center w-full">{content}</div>
  );
};

export default Loader;
