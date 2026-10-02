import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// Text wordmark. The PNG logos in assets/ carry the ViaKashmir mark, which is a
// different brand, so the public site uses this instead.
export const Wordmark = ({ className = "" }) => (
  <span className={`text-[19px] font-bold tracking-tight text-[#181c22] ${className}`}>
    Via<span className="font-serif italic font-normal">Itinerary</span>
  </span>
);

const NAV_LINKS = [
  { name: "Features", to: "/#features" },
  { name: "Solutions", to: "/solutions" },
  { name: "About", to: "/about-us" },
  { name: "FAQ", to: "/#faq" },
];

const Navbar = () => {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const isAuthenticated = Boolean(token && user);

  const linkClass = "text-[14px] font-medium text-[#4c4546] hover:text-[#181c22] transition-colors";

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-b border-black/[0.06]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <Link to="/" aria-label="ViaItinerary home">
          <Wordmark />
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Main">
          {NAV_LINKS.map((link) =>
            link.to.includes("#") ? (
              <a key={link.name} href={link.to} className={linkClass}>
                {link.name}
              </a>
            ) : (
              <NavLink key={link.name} to={link.to} className={linkClass}>
                {link.name}
              </NavLink>
            ),
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={`${linkClass} px-2`}>
                Log in
              </Link>
              <Link to="/schedule-demo" className="btn-secondary">
                Book a demo
              </Link>
              <Link to="/signup" className="btn-primary">
                Start free trial
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setIsOpen((v) => !v)}
          className="md:hidden -mr-2 p-2 rounded-lg text-[#181c22] hover:bg-black/5"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-black/[0.06] bg-white px-4 pb-5 pt-2">
          <nav className="flex flex-col" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.to}
                onClick={() => setIsOpen(false)}
                className="py-3 text-[15px] font-medium text-[#181c22] border-b border-black/[0.05]"
              >
                {link.name}
              </a>
            ))}
          </nav>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary col-span-2 justify-center" onClick={() => setIsOpen(false)}>
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-secondary justify-center" onClick={() => setIsOpen(false)}>
                  Log in
                </Link>
                <Link to="/signup" className="btn-primary justify-center" onClick={() => setIsOpen(false)}>
                  Start free trial
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
