import React from "react";
import { Link } from "react-router-dom";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import logoLight from "../../assets/logo-light.png";

const Navbar = () => {
  const { token, user } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const isAuthenticated = Boolean(token && user);

  const navLinks = [
    { name: "Features", href: "/#features" },
    { name: "Solutions", href: "/solutions" },
    { name: "Subscription", href: "/subscription" },
    { name: "Get My Travel Plan", href: "/lead-inquiry" },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-40 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo - Fixed width for alignment */}
            <Link
              to="/"
              className="flex items-center min-w-[140px] cursor-pointer"
            >
              <img
                src={logoLight}
                alt="ViaItinerary"
                className="h-26 w-auto object-contain block"
              />
            </Link>

            {/* Desktop Nav - Centered */}
            <div className="hidden md:flex items-center flex-1 justify-center">
              <div className="flex items-center gap-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={
                      link.name === "Subscription" && !isAuthenticated
                        ? "/login"
                        : link.href
                    }
                    className="text-[15px] text-[#475569] hover:text-[#10182A] font-medium transition-colors cursor-pointer"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Action Buttons - Fixed width for alignment */}
            <div className="hidden md:flex items-center gap-6 min-w-[200px] justify-end">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#143B36] text-white rounded-[14px] text-[15px] font-semibold hover:bg-[#143B36]/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm shadow-slate-200"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-[15px] font-medium text-[#475569] hover:text-[#143B36] transition-colors cursor-pointer"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-[#143B36] text-white px-7 py-3 rounded-xl text-[15px] font-bold hover:bg-[#143B36]/90 transition-all cursor-pointer"
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-[#10182A] hover:bg-slate-50 p-2 rounded-lg transition-colors focus:outline-none"
                aria-label="Toggle menu"
              >
                {isOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-[55] md:hidden transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Nav Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-[280px] bg-white z-[60] md:hidden transform transition-transform duration-300 ease-in-out shadow-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex justify-between items-center mb-10">
            <span className="text-xl font-black text-[#10182A]">Menu</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6 text-[#10182A]" />
            </button>
          </div>

          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={
                  link.name === "Subscription" && !isAuthenticated
                    ? "/login"
                    : link.href
                }
                className="text-[18px] text-[#475569] hover:text-[#10182A] font-semibold transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="mt-auto pt-8 border-t border-slate-100 flex flex-col gap-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="bg-[#143B36] text-white block text-center w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-slate-200"
                onClick={() => setIsOpen(false)}
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-center py-3 text-[16px] font-bold text-[#475569]"
                  onClick={() => setIsOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="bg-[#143B36] text-white block text-center w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-slate-200"
                  onClick={() => setIsOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
