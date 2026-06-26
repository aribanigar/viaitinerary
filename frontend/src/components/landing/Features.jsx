import React from "react";
import { motion } from "framer-motion";
import { FileText, Users, Globe, PieChart, Shield, Zap } from "lucide-react";

const Features = () => {
  const features = [
    {
      title: "Smart Itinerary Builder",
      description:
        "Create stunning, branded PDF itineraries in minutes with our drag-and-drop editor.",
      icon: <FileText className="w-6 h-6 text-[#043b36]" />,
    },
    {
      title: "Client Management",
      description:
        "Keep track of all your clients, their preferences, and travel history in one secure place.",
      icon: <Users className="w-6 h-6 text-[#043b36]" />,
    },
    {
      title: "Dynamic Routing",
      description:
        "Automatically calculate route durations and optimize travel plans day-by-day.",
      icon: <Globe className="w-6 h-6 text-[#043b36]" />,
    },
    {
      title: "Financial Reports",
      description:
        "Track your revenue, margins, and expenses with beautiful, easy-to-read charts.",
      icon: <PieChart className="w-6 h-6 text-[#043b36]" />,
    },
    {
      title: "Secure & Private",
      description:
        "Enterprise-grade security ensures your client data is always safe and backing up daily.",
      icon: <Shield className="w-6 h-6 text-[#043b36]" />,
    },
    {
      title: "Instant Quotes",
      description:
        "Generate accurate price quotes instantly based on live rates and markup rules.",
      icon: <Zap className="w-6 h-6 text-[#043b36]" />,
    },
  ];

  return (
    <section id="features" className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 md:mb-20 px-4">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6"
          >
            Everything you need to scale your agency
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-base md:text-lg text-slate-500 max-w-3xl mx-auto font-medium leading-relaxed"
          >
            Replace your spreadsheet chaos with a unified operating system
            designed for modern travel professionals.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="p-8 md:p-10 rounded-4xl bg-slate-50 hover:bg-slate-100 transition-colors duration-300 flex flex-col items-start text-left group cursor-pointer"
            >
              <div className="w-12 h-12 bg-white rounded-[14px] shadow-sm flex items-center justify-center mb-6 md:mb-8 border border-slate-100 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                {feature.title}
              </h3>
              <p className="text-slate-500 text-[15px] leading-relaxed font-medium">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
