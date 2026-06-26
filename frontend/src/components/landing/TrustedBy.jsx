import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plane, Globe, Building2, Briefcase } from "lucide-react";

const defaultLogos = [
  {
    name: "Udaan Holidays",
    icon: <Plane className="w-5 h-5 text-slate-400" />,
  },
  { name: "RTT Travels", icon: <Globe className="w-5 h-5 text-slate-400" /> },
  {
    name: "Golden Vacations",
    icon: <Building2 className="w-5 h-5 text-slate-400" />,
  },
  {
    name: "Neptune Pvt Ltd",
    icon: <Briefcase className="w-5 h-5 text-slate-400" />,
  },
  { name: "Club Side", icon: <Plane className="w-5 h-5 text-slate-400" /> },
  {
    name: "Andaman Experts",
    icon: <Globe className="w-5 h-5 text-slate-400" />,
  },
  { name: "Vitara", icon: <Building2 className="w-5 h-5 text-slate-400" /> },
];

const TrustedBy = () => {
  const [logos, setLogos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        const apiUrl =
          import.meta.env.VITE_API_URL || "http://localhost:8000/api";
        const response = await fetch(`${apiUrl}/trusted-companies`, {
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) throw new Error("Failed to fetch logos");

        const data = await response.json();

        if (data && data.length > 0) {
          setLogos(
            data.map((company) => ({
              name: company.name,
              image: company.logo_url || company.logo_path,
            })),
          );
        } else {
          setLogos(defaultLogos);
        }
      } catch (error) {
        console.error("Error fetching trusted companies:", error);
        setLogos(defaultLogos);
      } finally {
        setLoading(false);
      }
    };

    fetchLogos();
  }, []);

  if (loading && logos.length === 0) return null;

  return (
    <section className="py-12 md:py-20 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 mb-10 md:mb-16">
        <h2 className="text-center text-[10px] md:text-[11px] font-black text-[#64748B] uppercase tracking-[0.3em]">
          TRUSTED BY 500+ TRAVEL BUSINESSES WORLDWIDE
        </h2>
      </div>

      <div className="flex overflow-hidden group">
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: "-50%" }}
          transition={{
            duration: 35,
            repeat: Infinity,
            ease: "linear",
          }}
          className="flex gap-10 md:gap-16 items-center whitespace-nowrap px-10"
        >
          {/* Double list for infinite effect - using 3 for extra buffer */}
          {[...logos, ...logos, ...logos].map((logo, index) => (
            <div
              key={index}
              className="flex items-center gap-4 md:gap-5 group/item cursor-pointer"
            >
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#F8FAFC] rounded-[14px] md:rounded-2xl flex items-center justify-center border border-[#F1F5F9] transition-all group-hover/item:border-[#DBEAFE] group-hover/item:bg-[#EFF6FF]">
                <div className="text-[#94A3B8] transition-colors group-hover/item:text-[#2563EB] scale-90 md:scale-100 flex items-center justify-center overflow-hidden">
                  {logo.image ? (
                    <img
                      src={logo.image}
                      alt={logo.name}
                      className="w-full h-full object-contain p-1.5"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    logo.icon
                  )}
                </div>
              </div>
              <span className="text-[#64748B] font-bold text-base md:text-lg group-hover/item:text-[#2563EB] transition-colors">
                {logo.name}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustedBy;
