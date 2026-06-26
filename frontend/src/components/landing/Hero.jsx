import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen pt-28 md:pt-32 pb-16 md:pb-20 flex items-center overflow-hidden bg-[#043b36]">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=70&w=1200"
          srcSet="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=70&w=800 800w, https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=70&w=1200 1200w, https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=70&w=1600 1600w"
          sizes="100vw"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover opacity-25"
          fetchpriority="high"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-linear-to-r from-[#043b36] via-[#043b36]/80 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-start mb-6"
          >
            <div className="bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2.5 group cursor-pointer hover:bg-white/10 transition-all max-w-xs sm:max-w-none">
              <div className="w-2 h-2 shrink-0 rounded-full bg-[#faa81e] shadow-[0_0_10px_rgba(250,168,30,0.8)]"></div>
              <span className="text-xs sm:text-sm font-bold text-white/90 tracking-wide truncate">
                Your itinerary ready within 2 minutes
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl xl:text-7xl font-black text-white tracking-tight leading-[1.15] md:leading-[1.1] mb-6"
          >
            Powering the <br className="hidden md:block" />
            World’s <br className="hidden md:block" />
            <span className="text-[#faa81e]">Best Travel</span>{" "}
            <br className="hidden md:block" />
            Businesses
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base md:text-xl text-slate-300 max-w-xl mb-10 leading-relaxed font-medium"
          >
            The all-in-one platform for DMCs and Travel Agencies to create
            stunning itineraries, manage bookings, and scale operations
            effortlessly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 md:gap-5 mb-12"
          >
            <Link
              to="/schedule-demo"
              className="bg-[#faa81e] text-black px-8 py-4 rounded-xl font-bold text-[17px] hover:bg-[#e6971b] transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              Request For Demo
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="flex flex-wrap gap-x-8 gap-y-4"
          >
            {[
              "Everything you need to grow",
              "24/7 Support",
              "Cancel anytime",
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#faa81e]" />
                <span className="text-slate-400 font-bold text-sm tracking-wide">
                  {text}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
