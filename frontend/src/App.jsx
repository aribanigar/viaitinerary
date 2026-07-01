import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/landing/Navbar";
import Hero from "./components/landing/Hero";
import Modal from "./components/common/Modal";

// Lazy load almost everything else to optimize initial bundle
const DashboardMain = lazy(
  () => import("./components/dashboard/DashboardMain"),
);
const TrustedBy = lazy(() => import("./components/landing/TrustedBy"));
const Features = lazy(() => import("./components/landing/Features"));
const Showcase = lazy(() => import("./components/landing/Showcase"));
const Footer = lazy(() => import("./components/landing/Footer"));
const FilteredTrips = lazy(
  () => import("./components/dashboard/FilteredTrips"),
);
const TripBuilder = lazy(() => import("./components/dashboard/TripBuilder"));
const MyTrips = lazy(() => import("./components/dashboard/MyTrips"));
const Packages = lazy(() => import("./components/dashboard/Packages"));
const AgencySettings = lazy(
  () => import("./components/dashboard/AgencySettings"),
);
const GmailSmtpSettings = lazy(
  () => import("./components/dashboard/GmailSmtpSettings"),
);
const PaymentDetails = lazy(
  () => import("./components/dashboard/PaymentDetails"),
);
const Typography = lazy(() => import("./components/dashboard/Typography"));
const Destinations = lazy(() => import("./components/dashboard/Destinations"));
const Accommodation = lazy(
  () => import("./components/dashboard/Accommodation"),
);
const AccommodationForm = lazy(
  () => import("./pages/dashboard/AccommodationForm"),
);
const Vehicles = lazy(() => import("./components/dashboard/Vehicles"));
const Team = lazy(() => import("./components/dashboard/Team"));
const TeamReport = lazy(() => import("./components/dashboard/TeamReport"));
const Quotes = lazy(() => import("./components/dashboard/Quotes"));
const Profile = lazy(() => import("./components/dashboard/Profile"));
const Policies = lazy(() => import("./components/dashboard/Policies"));
const Subscription = lazy(() => import("./components/dashboard/Subscription"));
const Notifications = lazy(
  () => import("./components/dashboard/Notifications"),
);
const SuperAdminBusinesses = lazy(
  () => import("./components/dashboard/SuperAdminBusinesses"),
);
const SuperAdminDemoRequests = lazy(
  () => import("./components/dashboard/SuperAdminDemoRequests"),
);
const SuperAdminShowcase = lazy(
  () => import("./components/dashboard/SuperAdminShowcase"),
);
const SuperAdminTrustedCompanies = lazy(
  () => import("./components/dashboard/SuperAdminTrustedCompanies"),
);
const SuperAdminPlans = lazy(
  () => import("./components/dashboard/SuperAdminPlans"),
);
const SuperAdminBusinessDetails = lazy(
  () => import("./components/dashboard/SuperAdminBusinessDetails"),
);
const PublicInquiries = lazy(
  () => import("./components/dashboard/PublicInquiries"),
);
const Accounting = lazy(() => import("./components/dashboard/Accounting"));
const AccountingSummary = lazy(
  () => import("./components/dashboard/AccountingSummary"),
);
const Ledger = lazy(() => import("./components/dashboard/Ledger"));
// CalculatorList and CalculatorForm are not used in App.jsx routes, so we can ignore or remove if they really aren't used.
const LeadInquiries = lazy(
  () => import("./components/dashboard/LeadInquiries"),
);
const CreateLead = lazy(() => import("./pages/dashboard/CreateLead"));
const Integrations = lazy(() => import("./pages/Integrations"));
const EmbedSettings = lazy(
  () => import("./components/dashboard/EmbedSettings"),
);
const BlogPostList = lazy(() => import("./components/dashboard/BlogPostList"));
const BlogPostForm = lazy(() => import("./pages/dashboard/BlogPostForm"));
const BlogCategoryList = lazy(
  () => import("./components/dashboard/BlogCategoryList"),
);

const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Solutions = lazy(() => import("./pages/Solutions"));
const LeadInquiryForm = lazy(() => import("./pages/LeadInquiryForm"));
const NotFound = lazy(() => import("./pages/NotFound"));

import ScrollToHashElement from "./components/utils/ScrollToHashElement";

const Login = lazy(() => import("./components/auth/Login"));
const Signup = lazy(() => import("./components/auth/Signup"));
const ForgotPassword = lazy(() => import("./components/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./components/auth/ResetPassword"));
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";
import AdminRoute from "./components/auth/AdminRoute";
import SuperAdminRoute from "./components/auth/SuperAdminRoute";
const ScheduleDemo = lazy(() => import("./pages/ScheduleDemo"));

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { HelmetProvider } from "react-helmet-async";
import Loader from "./components/common/Loader";

import { Helmet } from "react-helmet-async";

const LandingPage = () => {
  const { token } = useAuth();
  const [showOffer, setShowOffer] = useState(false);
  const [offerData, setOfferData] = useState(null);
  const [renderBelowFold, setRenderBelowFold] = useState(false);

  useEffect(() => {
    const checkOffer = async () => {
      // Show every time on home page as requested
      try {
        const API_URL =
          import.meta.env.VITE_API_URL || "http://localhost:8000/api";
        const resp = await fetch(`${API_URL}/subscription/status`, {
          headers: {
            Accept: "application/json",
          },
        });
        const data = await resp.json();

        if (resp.ok && data.active_offer) {
          setOfferData(data.active_offer);
          setShowOffer(true);
        }
      } catch (err) {
        console.error("Failed to check for offers on landing:", err);
      }
    };

    checkOffer();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const enableBelowFold = () => {
      if (!cancelled) {
        setRenderBelowFold(true);
      }
    };

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(enableBelowFold, {
          timeout: 2000,
        });
        return () => {
          cancelled = true;
          if ("cancelIdleCallback" in window) {
            window.cancelIdleCallback(idleId);
          }
        };
      }

      const timeoutId = window.setTimeout(enableBelowFold, 1200);
      return () => {
        cancelled = true;
        window.clearTimeout(timeoutId);
      };
    }

    setRenderBelowFold(true);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>
          ViaItinerary: Travel CRM, Itinerary Builder & Lead Management Software
        </title>
        <meta
          name="description"
          content="Automate your travel business with ViaItinerary. Professional itinerary planning, client management, and real-time cost calculation for travel agents."
        />
        <meta
          name="keywords"
          content="Best Travel CRM Agency, travel software, travel agency software, travel agent crm, crm software company, crm Systems, travel itinerary, crm for travel agents, travel website development, software development, ViaItinerary, travel packages, tour packages, honeymoon packages, family packages, best tour operator, hotel booking, cab booking"
        />
        <link rel="canonical" href={window.location.href} />
        <meta name="robots" content="index, follow" />
        <meta name="X-Robots-Tag" content="index, follow" />
        <meta name="author" content="ViaItinerary" />
        <meta name="publisher" content="ViaItinerary" />
        <link rel="publisher" href={window.location.href} />
      </Helmet>
      <Navbar />
      <main>
        <Hero />
        {renderBelowFold && (
          <Suspense fallback={<div className="h-24" />}>
            <TrustedBy />
            <Features />
            <Showcase />
          </Suspense>
        )}
      </main>
      {renderBelowFold && (
        <Suspense fallback={<div className="h-24" />}>
          <Footer />
        </Suspense>
      )}

      {/* Offer Popup Modal */}
      {showOffer && offerData && (
        <Modal
          isOpen={showOffer}
          onClose={() => setShowOffer(false)}
          title={offerData.name}
          pureContent={true}
        >
          {offerData.offer_image && (
            <a
              href={token ? "/subscription" : "/login"}
              onClick={(e) => {
                e.preventDefault();
                setShowOffer(false);
                window.location.href = token ? "/subscription" : "/login";
              }}
              className="block overflow-hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:scale-[1.01] transition-transform duration-300"
            >
              <img
                src={offerData.offer_image}
                alt="Special Offer"
                className="w-full h-auto object-cover"
              />
            </a>
          )}
        </Modal>
      )}
    </div>
  );
};

const PublicWhatsAppCTA = () => {
  const location = useLocation();

  const portalRoutePrefixes = [
    "/dashboard",
    "/trip-builder",
    "/my-trips",
    "/packages",
    "/package-builder",
    "/profile",
    "/subscription",
    "/notifications",
    "/destinations",
    "/accommodation",
    "/transportation",
    "/team",
    "/team-report",
    "/quotes",
    "/settings",
    "/payment-details",
    "/ledger",
    "/typography",
    "/accounting",
    "/confirmation-email",
    "/lead-inquiries",
    "/integrations",
    "/embed-settings",
    "/policies",
    "/businesses",
    "/public-leads",
    "/admin",
    "/demo-requests",
  ];

  const shouldHide = portalRoutePrefixes.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  if (shouldHide) {
    return null;
  }

  return (
    <a
      href="https://wa.me/919186051499?text=Hello%20I%20am%20looking%20for"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-2.5 rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group"
      aria-label="Chat on WhatsApp"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
        alt="WhatsApp"
        className="w-7 h-7 md:w-9 md:h-9"
      />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2.5 transition-all duration-500 font-bold whitespace-nowrap text-base">
        Chat with us
      </span>
    </a>
  );
};

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <NotificationProvider>
            <Router>
              <ScrollToHashElement />
              <Suspense fallback={<Loader fullPage={true} />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />

                  {/* Guest-only Routes */}
                  <Route element={<GuestRoute />}>
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route
                      path="/forgot-password"
                      element={<ForgotPassword />}
                    />
                    <Route path="/reset-password" element={<ResetPassword />} />
                  </Route>

                  <Route path="/schedule-demo" element={<ScheduleDemo />} />
                  <Route path="/refund-policy" element={<RefundPolicy />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route
                    path="/terms-of-service"
                    element={<TermsOfService />}
                  />
                  <Route path="/about-us" element={<AboutUs />} />
                  <Route path="/solutions" element={<Solutions />} />
                  <Route path="/lead-inquiry" element={<LeadInquiryForm />} />

                  {/* Protected Routes - All authenticated users */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardMain />} />
                    <Route
                      path="/dashboard/trips"
                      element={<FilteredTrips />}
                    />
                    <Route path="/trip-builder" element={<TripBuilder />} />
                    <Route
                      path="/trip-builder/:tripId"
                      element={<TripBuilder />}
                    />
                    <Route path="/my-trips" element={<MyTrips />} />
                    <Route path="/packages" element={<Packages />} />
                    <Route path="/package-builder" element={<TripBuilder mode="package" />} />
                    <Route
                      path="/package-builder/:tripId"
                      element={<TripBuilder mode="package" />}
                    />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/subscription" element={<Subscription />} />
                    <Route path="/notifications" element={<Notifications />} />
                  </Route>

                  {/* Resource Management - Accessible by Admin, Super Admin, and Team */}
                  <Route
                    element={
                      <ProtectedRoute
                        allowedRoles={["admin", "super_admin", "team"]}
                      />
                    }
                  >
                    <Route path="/destinations" element={<Destinations />} />
                    <Route path="/accommodation" element={<Accommodation />} />
                    <Route
                      path="/accommodation/add"
                      element={<AccommodationForm />}
                    />
                    <Route
                      path="/accommodation/edit/:id"
                      element={<AccommodationForm />}
                    />
                    <Route path="/transportation" element={<Vehicles />} />
                    <Route path="/lead-inquiries" element={<LeadInquiries />} />
                  </Route>

                  {/* Admin Routes - Admin and Super Admin only */}
                  <Route element={<AdminRoute />}>
                    <Route path="/team" element={<Team />} />
                    <Route path="/team-report" element={<TeamReport />} />
                    <Route path="/quotes" element={<Quotes />} />
                    <Route path="/settings" element={<AgencySettings />} />
                    <Route
                      path="/settings/email-connect"
                      element={<GmailSmtpSettings />}
                    />
                    <Route
                      path="/payment-details"
                      element={<PaymentDetails />}
                    />
                    <Route path="/ledger" element={<Ledger />} />
                    <Route path="/typography" element={<Typography />} />
                    <Route path="/accounting" element={<Accounting />} />
                    <Route
                      path="/accounting-summary"
                      element={<AccountingSummary />}
                    />
                    <Route
                      path="/confirmation-email"
                      element={<Navigate to="/accounting" replace />}
                    />
                    <Route
                      path="/lead-inquiries/create"
                      element={<CreateLead />}
                    />
                    <Route path="/integrations" element={<Integrations />} />
                    <Route
                      path="/integrations/:platform"
                      element={<Integrations />}
                    />
                    <Route path="/embed-settings" element={<EmbedSettings />} />
                    <Route path="/policies" element={<Policies />} />
                  </Route>

                  {/* Super Admin Routes */}
                  <Route element={<SuperAdminRoute />}>
                    <Route
                      path="/businesses"
                      element={<SuperAdminBusinesses />}
                    />
                    <Route
                      path="/businesses/:businessId"
                      element={<SuperAdminBusinessDetails />}
                    />
                    <Route path="/public-leads" element={<PublicInquiries />} />
                    <Route path="/admin/plans" element={<SuperAdminPlans />} />
                    <Route
                      path="/demo-requests"
                      element={<SuperAdminDemoRequests />}
                    />
                    <Route
                      path="/admin/showcase"
                      element={<SuperAdminShowcase />}
                    />
                    <Route
                      path="/admin/trusted-companies"
                      element={<SuperAdminTrustedCompanies />}
                    />

                    {/* Blog Routes - Super Admin Only */}
                    <Route
                      path="/admin/blog/posts"
                      element={<BlogPostList />}
                    />
                    <Route
                      path="/admin/blog/posts/new"
                      element={<BlogPostForm />}
                    />
                    <Route
                      path="/admin/blog/posts/:id/edit"
                      element={<BlogPostForm />}
                    />
                    <Route
                      path="/admin/blog/categories"
                      element={<BlogCategoryList />}
                    />
                  </Route>

                  {/* 404 Page - Catch All */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <PublicWhatsAppCTA />
            </Router>
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />
          </NotificationProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
