import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, IndianRupee, ArrowRight, Loader2 } from "lucide-react";
import { fetchShowcaseItems } from "../../api/showcase";

const WhatsAppIcon = ({ size = 16, className = "" }) => (
  <img
    src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
    alt="WhatsApp"
    style={{
      width: size,
      height: size,
      display: "inline-block",
      verticalAlign: "middle",
    }}
    className={className}
  />
);

const Showcase = () => {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await fetchShowcaseItems(true);
        setItineraries(data);
      } catch (error) {
        console.error("Failed to fetch showcase items:", error);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, []);

  return (
    <section className="py-20 md:py-32 bg-[#043b36] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start justify-between mb-12 md:mb-20 gap-8">
          <div className="max-w-xl">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-3xl md:text-6xl font-black text-white mb-6 leading-[1.2] md:leading-tight"
            >
              Create Itineraries That Sell Themselves
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              viewport={{ once: true }}
              className="text-base md:text-lg text-gray-400 font-medium"
            >
              Deliver stunning, mobile-responsive proposals that your clients
              can't resist. Our drag-and-drop builder makes it effortless.
            </motion.p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        ) : itineraries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {itineraries.map((item, index) => (
              <motion.div
                key={item.id || index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative h-96 md:h-130 rounded-3xl overflow-hidden cursor-pointer"
              >
                <img
                  src={
                    item.image_url ||
                    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=600&h=800"
                  }
                  alt={item.city}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent"></div>

                <div className="absolute bottom-8 left-6 right-6">
                  <div className="inline-block bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-lg mb-4">
                    <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                      Suggested Itinerary
                    </span>
                  </div>

                  <h3 className="text-3xl font-black text-white mb-2 leading-tight">
                    {item.city}
                  </h3>

                  {item.agency_name && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-white/70 text-xs font-bold uppercase tracking-wider">
                        {item.agency_name}
                      </span>
                      {item.whatsapp_number && (
                        <a
                          href={`https://wa.me/${item.whatsapp_number.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors shadow-lg"
                        >
                          <WhatsAppIcon size={14} className="fill-current" />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-white/90">
                    <p className="text-sm font-bold">{item.title}</p>
                    <span className="text-lg font-black">₹{item.price}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
            <p className="text-gray-400 font-medium">
              No itineraries available at the moment.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Showcase;
