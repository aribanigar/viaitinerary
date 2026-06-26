import React from "react";
import DashboardLayout from "./DashboardLayout";

const Quotes = () => {
  return (
    <DashboardLayout>
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-900 leading-tight">
          Quotes
        </h1>
        <p className="text-slate-400 font-medium mt-1">
          Manage and track trip quotes and pricing proposals.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Quotes Management
          </h2>
          <p className="text-gray-500 mb-6">
            This feature is coming soon. You'll be able to create and manage
            trip quotes, track pricing proposals, and handle client negotiations
            here.
          </p>
          <div className="flex justify-center space-x-4">
            <div className="bg-gray-50 rounded-lg p-4 w-48">
              <h3 className="font-medium text-gray-900">Create Quotes</h3>
              <p className="text-sm text-gray-500">
                Generate pricing proposals for trips
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 w-48">
              <h3 className="font-medium text-gray-900">Quote Tracking</h3>
              <p className="text-sm text-gray-500">
                Monitor quote status and conversions
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 w-48">
              <h3 className="font-medium text-gray-900">
                Client Communication
              </h3>
              <p className="text-sm text-gray-500">
                Manage quote discussions and updates
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Quotes;
