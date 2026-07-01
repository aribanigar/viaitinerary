import React from "react";
import Navbar from "../components/landing/Navbar";
import Footer from "../components/landing/Footer";
import pdfFile from "../assets/itinerary-solutions.pdf";

const Solutions = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow pt-24 md:pt-28 flex flex-col items-center">
        <div className="w-full max-w-7xl px-2 sm:px-4 py-4 md:py-8 flex-grow flex flex-col">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-grow flex flex-col border border-gray-200">
            <div className="bg-[#1a1c1c] p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-center text-white gap-3 sm:gap-4">
              <h1 className="text-lg sm:text-xl font-bold text-center sm:text-left">
                ViaItinerary Itinerary Solutions
              </h1>
              <a
                href={pdfFile}
                download="itinerary-solutions.pdf"
                className="w-full sm:w-auto bg-[#1b1b1b] hover:bg-[#0a0a0a] text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex justify-center items-center gap-2 text-sm sm:text-base"
              >
                Download PDF
              </a>
            </div>

            {/* Mobile Helper Message */}
            <div className="block md:hidden bg-amber-50 p-2 text-xs text-amber-800 text-center border-b border-amber-100">
              On mobile? Use the download button for the best experience.
            </div>

            <div className="flex-grow relative h-[500px] sm:h-[600px] md:min-h-[70vh]">
              <iframe
                src={`${pdfFile}#view=FitH`}
                title="ViaItinerary Itinerary Solutions"
                className="absolute inset-0 w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Solutions;
