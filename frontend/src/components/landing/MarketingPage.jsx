import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import Seo from "./Seo";
import { breadcrumbSchema } from "./schema";

// Shell for inner public pages: header, visible breadcrumb (mirrored in
// BreadcrumbList JSON-LD), compact page intro, then the page body.
const MarketingPage = ({ title, description, path, crumb, eyebrow, heading, intro, schema = [], pageType, children }) => {
  const trail = [
    { name: "Home", path: "/" },
    { name: crumb, path },
  ];
  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#181c22] font-sans antialiased">
      <Seo
        title={title}
        description={description}
        path={path}
        pageType={pageType}
        schema={[breadcrumbSchema(trail), ...schema]}
      />
      <Navbar />
      <main>
        <section className="px-4 sm:px-6 pt-28 md:pt-32 pb-10 md:pb-12 bg-white border-b border-black/[0.06]">
          <div className="max-w-6xl mx-auto">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[13px] text-[#7e7576]">
              <Link to="/" className="hover:text-[#181c22]">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#181c22]" aria-current="page">{crumb}</span>
            </nav>
            {eyebrow && <p className="eyebrow mt-6">{eyebrow}</p>}
            <h1 className="mt-3 text-[32px] md:text-[44px] leading-[1.1] font-semibold tracking-tight max-w-3xl">{heading}</h1>
            {intro && <p className="mt-4 text-[17px] leading-relaxed text-[#5e5e5e] max-w-2xl">{intro}</p>}
          </div>
        </section>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default MarketingPage;
