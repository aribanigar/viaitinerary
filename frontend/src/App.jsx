import React, { useState, useEffect, Suspense } from "react";
import lazy from "./utils/lazyWithReload";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/landing/Navbar";
import BrandLanding from "./components/landing/BrandLanding";
import Modal from "./components/common/Modal";

// Lazy load almost everything else to optimize initial bundle
const DashboardMain = lazy(
  () => import("./components/dashboard/DashboardMain"),
);
const Showcase = lazy(() => import("./components/landing/Showcase"));
const Footer = lazy(() => import("./components/landing/Footer"));
const FilteredTrips = lazy(
  () => import("./components/dashboard/FilteredTrips"),
);
const TripBuilder = lazy(() => import("./components/dashboard/TripBuilder"));
const GenerateItinerary = lazy(
  () => import("./pages/dashboard/GenerateItinerary"),
);
const MyTrips = lazy(() => import("./components/dashboard/MyTrips"));
const AIAssistant = lazy(() => import("./pages/assistant/AIAssistant"));
const Packages = lazy(() => import("./components/dashboard/Packages"));
const SsoLogin = lazy(() => import("./pages/SsoLogin"));
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
const ComplementaryServices = lazy(
  () => import("./components/dashboard/ComplementaryServices"),
);
const Activities = lazy(() => import("./components/dashboard/Activities"));
const DestinationForm = lazy(() => import("./pages/dashboard/DestinationForm"));
const Accommodation = lazy(
  () => import("./components/dashboard/Accommodation"),
);
const ActivityForm = lazy(() => import("./pages/dashboard/ActivityForm"));
const AccommodationForm = lazy(
  () => import("./pages/dashboard/AccommodationForm"),
);
const HotelBookingCalendar = lazy(
  () => import("./components/dashboard/HotelBookingCalendar"),
);
const Vehicles = lazy(() => import("./components/dashboard/Vehicles"));
const VehicleForm = lazy(() => import("./pages/dashboard/VehicleForm"));
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
const Proposal = lazy(() => import("./pages/Proposal"));
const SupplierConfirm = lazy(() => import("./pages/SupplierConfirm"));
const Operations = lazy(() => import("./components/dashboard/Operations"));

import ScrollToHashElement from "./components/utils/ScrollToHashElement";
import ChingWidget from "./components/ching/ChingWidget";

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

const LandingPage = () => {
  const { token } = useAuth();
  const [showOffer, setShowOffer] = useState(false);
  const [offerData, setOfferData] = useState(null);

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

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      <BrandLanding />

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

// Signed-in app ("portal") routes: no public WhatsApp bubble there; Ching
// (the voice trip builder) shows only there.
const PORTAL_ROUTE_PREFIXES = [
  "/dashboard",
  "/assistant",
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
  "/complementary-services",
  "/activities",
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
  "/operations",
];

const isPortalPath = (pathname) =>
  PORTAL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const PortalChing = () => {
  const { token, passwordUpdateRequired } = useAuth();
  const { pathname } = useLocation();
  if (!token || passwordUpdateRequired || !isPortalPath(pathname)) return null;
  return <ChingWidget />;
};

const PublicWhatsAppCTA = () => {
  const location = useLocation();

  // Also hidden on client proposals (/p/:token): those pages belong to the
  // agency, and this bubble is the platform's own.
  const shouldHide =
    isPortalPath(location.pathname) || location.pathname.startsWith("/p/") || location.pathname.startsWith("/s/");

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

                  {/* DMC partner login handoff from viakashmir.in - public,
                      not gated by GuestRoute/ProtectedRoute since it's the
                      thing that CREATES the session (see SsoLogin.jsx). */}
                  <Route path="/sso-login" element={<SsoLogin />} />

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
                  {/* Client proposal — public, no auth guard either way. */}
                  <Route path="/p/:token" element={<Proposal />} />
                  <Route path="/s/:token" element={<SupplierConfirm />} />

                  {/* Protected Routes - All authenticated users */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardMain />} />
                    <Route
                      path="/dashboard/trips"
                      element={<FilteredTrips />}
                    />
                    <Route path="/trip-builder" element={<TripBuilder />} />
                    <Route
                      path="/trip-builder/generate"
                      element={<GenerateItinerary />}
                    />
                    <Route
                      path="/trip-builder/:tripId"
                      element={<TripBuilder />}
                    />
                    <Route path="/my-trips" element={<MyTrips />} />
                    <Route path="/operations" element={<Operations />} />
                    <Route path="/assistant" element={<AIAssistant />} />
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
                    <Route
                      path="/complementary-services"
                      element={<ComplementaryServices />}
                    />
                    <Route path="/activities" element={<Activities />} />
                    <Route path="/activities/add" element={<ActivityForm />} />
                    <Route path="/activities/edit/:id" element={<ActivityForm />} />
                    <Route
                      path="/destinations/add"
                      element={<DestinationForm />}
                    />
                    <Route
                      path="/destinations/edit/:id"
                      element={<DestinationForm />}
                    />
                    <Route path="/accommodation" element={<Accommodation />} />
                    <Route
                      path="/accommodation/add"
                      element={<AccommodationForm />}
                    />
                    <Route
                      path="/accommodation/edit/:id"
                      element={<AccommodationForm />}
                    />
                    <Route
                      path="/accommodation/calendar"
                      element={<HotelBookingCalendar />}
                    />
                    <Route path="/transportation" element={<Vehicles />} />
                    <Route
                      path="/transportation/add"
                      element={<VehicleForm />}
                    />
                    <Route
                      path="/transportation/edit/:id"
                      element={<VehicleForm />}
                    />
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
              <PortalChing />
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
