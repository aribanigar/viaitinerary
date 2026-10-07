import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  useParams,
  useNavigate,
  useSearchParams,
  Link,
} from "react-router-dom";
import AssistantFrame from "./AssistantFrame";
import { destinationActivityLabels } from "../../utils/destinationActivities";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import {
  LayoutDashboard,
  Save,
  Download,
  Calendar,
  Settings as SettingsIcon,
  Image as ImageIcon,
  MapPin,
  Briefcase,
  Plus,
  Minus,
  Users,
  Trash2,
  Pencil,
  X,
  CheckCircle,
  Hotel,
  IndianRupee,
  Percent,
  ShieldCheck,
  Clock,
  Package as PackageIcon,
  MessageCircle,
  History as HistoryIcon,
  CircleAlert,
  Send,
  Link2,
  Mail,
  Eye,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  createTrip,
  updateTrip,
  fetchTrips,
  fetchTripRevisions,
  logTripSend,
  emailItineraryToMe,
  fetchProposal,
  sendProposal as sendProposalApi,
  sendReminder as sendReminderApi,
  downloadQuotationExcel,
} from "../../api/trips";
import {
  createPackage,
  updatePackage,
  fetchPackages,
  usePackage,
} from "../../api/packages";
import Loader from "../common/Loader";
import ModernTemplate from "./ModernTemplate";
import { toast } from "react-toastify";
import DatePicker from "../common/DatePicker";
import ItineraryTab from "./trip-builder/ItineraryTab";
import LogisticsTab from "./trip-builder/LogisticsTab";
import PricingTab from "./trip-builder/PricingTab";
import TripPayments from "./trip-builder/TripPayments";
import TripBookings from "./trip-builder/TripBookings";
import { HotelModal, TransportModal, ActivityModal } from "./trip-builder/TripBuilderModals";
import { tripActivityTotal, dateForDay } from "../../utils/activityRates";
import { priceBreakdown } from "../../utils/ching/pricing";
import TripInfoTab from "./trip-builder/TripInfoTab";
import { registerChingEditor } from "../../utils/ching/editorBridge";
import { getChingMemory, invalidateChingMemory } from "../../utils/ching/memoryStore";
import { cheaperPlan, addOnSuggestions } from "../../utils/ching/optimize";
import { formatTripImageUrl, normalizeAccommodation } from "../../utils/tripView";
import { applyEditActions, buildEditContext } from "../../utils/ching/editTrip";
import { buildTripDraft } from "../../utils/ching/tripDraft";
import { planLive, isBlankTrip } from "../../utils/ching/liveFill";
import { tripChecklist, pendingByTab } from "../../utils/tripChecklist";
import {
  DRAFT_KEY,
  useTripBuilderData,
} from "./trip-builder/useTripBuilderData";

const TRIGGER_LABELS = {
  export: "PDF Export",
  whatsapp_share: "WhatsApp Share",
  confirmation_email: "Confirmation Email",
};

const TABS_KEY = "builder_open_tabs";
const readTabs = () => {
  try {
    return JSON.parse(localStorage.getItem(TABS_KEY)) || [];
  } catch {
    return [];
  }
};

// embedded: rendered inside another page (the AI Assistant's live builder)
// instead of as its own route — no page frame, the trip id comes from the host
// (embeddedTripId) and a new trip's first save stays on that page.
const TripBuilder = ({ mode, embedded = false, embeddedTripId = null }) => {
  const isPackageMode = mode === "package";
  const { token } = useAuth();
  const { tripId: routeTripId } = useParams();
  const urlTripId = embedded ? embeddedTripId || undefined : routeTripId;
  const [searchParams] = useSearchParams();
  const draftKey = searchParams.get("d") || (embedded ? "assistant" : "default");
  const navigate = useNavigate();

  // Stable module-level helper (shared with the client proposal page).
  const formatImageUrl = formatTripImageUrl;

  const [activeTab, setActiveTab] = useState("Trip Info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [amendmentsOpen, setAmendmentsOpen] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [loadedTabId, setLoadedTabId] = useState(null);
  const [defaultTripImage, setDefaultTripImage] = useState("");
  const [agencySettings, setAgencySettings] = useState({
    agencyName: "TravelAgency",
    phone: "+1 234 567 890",
    website: "www.youragency.com",
    companyAddress: "",
    email: "contact@agency.com",
    whatsapp: "+1 234 567 890",
    brandColor: "#F4A229",
    logo: null,
    tagline:
      "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES",
    greetingMessage:
      "Greetings from {agencyName}. Our team has put up this Quote regarding your upcoming trip. Please review it and let us know if you would like any changes.",
    beneficiaryName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    defaultTripImage: null,
  });
  const [policies, setPolicies] = useState({
    termsConditions: "",
    mustHaves: "",
    rolesResponsibilities: "",
    cancellationPolicy: "",
    additionalExpenses: "",
    defaultInclusions: "",
    defaultExclusions: "",
  });
  const [inclusions, setInclusions] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [tripInfo, setTripInfo] = useState({
    tripId: urlTripId || `TRP${Math.floor(100000 + Math.random() * 900000)}`,
    tripTitle: "",
    destination: "",
    destinationId: null,
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    adults: 2,
    kidsUpto5: 0,
    kids5to12: 0,
    startDate: new Date().toISOString().split("T")[0],
    duration: "2",
    cost: "0",
    currency: "INR (₹)",
    image: "",
    tagline:
      "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES",
    status: "pending",
    template: "ModernTemplate", // Default template
    useFlight: false,
    transportDetails: [],
  });
  const [includeGST, setIncludeGST] = useState(true);
  const [gstPercentage, setGstPercentage] = useState(0);
  const [profitMarginPercentage, setProfitMarginPercentage] = useState(0);
  // Guards the auto-cost effect below from firing before gstPercentage/
  // profitMarginPercentage have been restored for the trip being loaded —
  // without this, reopening a saved trip briefly has both at their 0
  // defaults, which the effect would treat as a real edit and use to
  // silently overwrite (and then autosave) the trip's actual quoted price.
  // Only flips true once the agent actually edits pricing themselves.
  const [pricingTouched, setPricingTouched] = useState(false);
  const handleGstPercentageChange = (value) => {
    setPricingTouched(true);
    setGstPercentage(value);
  };
  const handleProfitMarginPercentageChange = (value) => {
    setPricingTouched(true);
    setProfitMarginPercentage(value);
  };
  const [otherCosts, setOtherCosts] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  // The quoted total (tripInfo.cost — what's saved, printed and exported) is
  // recomputed only once pricingTouched is true. That has to cover EVERY edit
  // that changes the price, not just GST%/margin%: otherwise adding a hotel,
  // cab or activity left the exported total stale.
  const touchesPricing = (setter) => (...args) => {
    setPricingTouched(true);
    return setter(...args);
  };

  const standardInclusions = Array.isArray(policies.defaultInclusions)
    ? policies.defaultInclusions.filter((i) => i.trim() !== "")
    : [];

  const standardExclusions = Array.isArray(policies.defaultExclusions)
    ? policies.defaultExclusions.filter((i) => i.trim() !== "")
    : [];

  const [accommodations, setAccommodations] = useState([]);
  const [transportation, setTransportation] = useState([]);
  const [tripActivities, setTripActivities] = useState([]);
  const [availableDestinations, setAvailableDestinations] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [masterHotels, setMasterHotels] = useState([]);
  const [availableActivities, setAvailableActivities] = useState([]);

  const parseAccommodationDate = useCallback((dateValue) => {
    if (!dateValue) return null;

    if (dateValue instanceof Date) {
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    if (typeof dateValue === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [year, month, day] = dateValue.split("-").map(Number);
        const parsed = new Date(year, month - 1, day);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split("-").map(Number);
        const parsed = new Date(year, month - 1, day);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      const parsed = new Date(dateValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }, []);

  const resolvedAccommodations = useMemo(() => {
    if (!accommodations || accommodations.length === 0) return [];

    return accommodations.map((item) => {
      const hotelId = item.hotelId ?? item.hotel_id;
      const hotelMatch = masterHotels.find(
        (hotel) => String(hotel.id) === String(hotelId),
      );
      const hotelData = item.hotel || hotelMatch;

      if (!hotelData) {
        return item;
      }

      return {
        ...item,
        name: hotelData.name ?? item.name,
        city: hotelData.city ?? item.city,
      };
    });
  }, [accommodations, masterHotels]);

  // Memoized sorted accommodations for sidebar display
  const groupedAccommodations = useMemo(() => {
    if (!resolvedAccommodations || resolvedAccommodations.length === 0)
      return [];

    // Keep a simple sorted list so each booking remains a separate record.
    const sorted = [...resolvedAccommodations].sort((a, b) => {
      if (!a.checkIn) return 1;
      if (!b.checkIn) return -1;
      return new Date(a.checkIn) - new Date(b.checkIn);
    });

    return sorted.map((hotel) => ({
      ...hotel,
      allDates: [
        { id: hotel.id, checkIn: hotel.checkIn, checkOut: hotel.checkOut },
      ],
      allIds: [hotel.id],
    }));
  }, [resolvedAccommodations]);

  // Memoized sorted transportation
  const sortedTransportation = useMemo(() => {
    return [...transportation].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date) - new Date(b.date);
    });
  }, [transportation]);

  const formatAgeGroupLabel = (value) => {
    if (value === "5_to_12") return "5 to 12";
    if (value === "above_12") return "Above 12";
    if (value === "cnb") return "CNB";
    return value;
  };

  useTripBuilderData({
    token,
    urlTripId,
    draftKey,
    setLoadedTabId,
    navigate,
    loading,
    setLoading,
    tripInfo,
    itinerary,
    accommodations,
    transportation,
    tripActivities,
    inclusions,
    exclusions,
    otherCosts,
    includeGST,
    gstPercentage,
    profitMarginPercentage,
    setDefaultTripImage,
    setAgencySettings,
    setAvailableDestinations,
    setAvailableVehicles,
    setMasterHotels,
    setAvailableActivities,
    setPolicies,
    setTripInfo,
    setIncludeGST,
    setInclusions,
    setExclusions,
    setOtherCosts,
    setItinerary,
    setAccommodations,
    setTransportation,
    setTripActivities,
    setHasDraft,
    setGstPercentage,
    setProfitMarginPercentage,
    setPricingTouched,
    formatImageUrl,
    normalizeAccommodation,
    toast,
  });

  // Local state for new inclusion/exclusion input
  const [newInclusion, setNewInclusion] = useState("");
  const [newExclusion, setNewExclusion] = useState("");
  const [editingInclusionIndex, setEditingInclusionIndex] = useState(null);
  const [editingInclusionValue, setEditingInclusionValue] = useState("");
  const [editingExclusionIndex, setEditingExclusionIndex] = useState(null);
  const [editingExclusionValue, setEditingExclusionValue] = useState("");

  const addInclusion = () => {
    if (newInclusion.trim()) {
      setInclusions([...inclusions, { content: newInclusion.trim() }]);
      setNewInclusion("");
    }
  };

  const removeInclusion = (index) => {
    setInclusions(inclusions.filter((_, i) => i !== index));
  };

  const saveInclusionEdit = (index) => {
    if (editingInclusionValue.trim()) {
      const updated = [...inclusions];
      updated[index] = {
        ...updated[index],
        content: editingInclusionValue.trim(),
      };
      setInclusions(updated);
    }
    setEditingInclusionIndex(null);
  };

  const addExclusion = () => {
    if (newExclusion.trim()) {
      setExclusions([...exclusions, { content: newExclusion.trim() }]);
      setNewExclusion("");
    }
  };

  const removeExclusion = (index) => {
    setExclusions(exclusions.filter((_, i) => i !== index));
  };

  const saveExclusionEdit = (index) => {
    if (editingExclusionValue.trim()) {
      const updated = [...exclusions];
      updated[index] = {
        ...updated[index],
        content: editingExclusionValue.trim(),
      };
      setExclusions(updated);
    }
    setEditingExclusionIndex(null);
  };

  const [isHotelModalOpen, setIsHotelModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingHotelId, setEditingHotelId] = useState(null);
  const [editingTransportId, setEditingTransportId] = useState(null);
  const [editingActivityId, setEditingActivityId] = useState(null);

  const reservedAccommodationDates = useMemo(() => {
    const reservedDates = new Map();

    accommodations.forEach((item) => {
      if (editingHotelId && item.id === editingHotelId) return;

      const checkInDate = parseAccommodationDate(item.checkIn);
      const checkOutDate = parseAccommodationDate(item.checkOut);
      if (!checkInDate) return;

      const start = new Date(
        checkInDate.getFullYear(),
        checkInDate.getMonth(),
        checkInDate.getDate(),
      );

      let end = checkOutDate
        ? new Date(
            checkOutDate.getFullYear(),
            checkOutDate.getMonth(),
            checkOutDate.getDate(),
          )
        : null;

      // Treat check-out as exclusive. If missing/invalid range, reserve at least check-in day.
      if (!end || end <= start) {
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      }

      for (
        let cursor = new Date(start);
        cursor < end;
        cursor.setDate(cursor.getDate() + 1)
      ) {
        const day = new Date(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
        );
        reservedDates.set(day.getTime(), day);
      }
    });

    return Array.from(reservedDates.values());
  }, [accommodations, editingHotelId, parseAccommodationDate]);

  const [hotelForm, setHotelForm] = useState({
    hotelId: null,
    name: "",
    city: "",
    category: "4 Star",
    roomType: "Deluxe",
    checkIn: "",
    checkOut: "",
    rooms: "1",
    cnbCount: "0",
    extraBeds5To12Count: "0",
    extraBedsAbove12Count: "0",
    extraAdultCount: "0",
    mealPlan: "",
    pricePerRoom: "",
    bedPrices: [],
    photo: null,
    cancelled: false,
    cancellationCharge: "",
    cancellationNote: "",
    alternateOptions: [],
    markupPercentage: "",
  });

  const uniqueCities = [...new Set(masterHotels.map((h) => h.city))]
    .filter(Boolean)
    .sort();
  const hotelsInCity = masterHotels
    .filter((h) => h.city === hotelForm.city)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [transportForm, setTransportForm] = useState({
    vehicleId: null,
    tripType: "Transfer",
    route: "",
    destination: "",
    date: "",
    vehicleType: "",
    quantity: 1,
    remarks: "",
    markupPercentage: "",
  });

  // A blank activity: priced per person, so the head-count starts at the
  // people who'd actually buy a ticket (adults + kids 5-12; under-5s are
  // normally free) and the location at the trip's destination.
  const blankActivityForm = () => ({
    activityId: null,
    name: "",
    location: tripInfo.destination || "",
    dayNumber: "",
    // Adults buy adult tickets; kids 5-12 child tickets (under-5s are
    // normally free).
    ticketCount: String(Math.max(1, Number(tripInfo.adults) || 0)),
    childCount: String(Math.max(0, Number(tripInfo.kids5to12) || 0)),
    pricePerTicket: "",
    childPrice: "",
    costPerTicket: "",
    childCost: "",
    rateOption: "",
    city: "",
    date: "",
    photo: null,
    markupPercentage: "",
    notes: "",
  });
  const [activityForm, setActivityForm] = useState(blankActivityForm);

  const handleHotelPhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHotelForm({ ...hotelForm, photo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddHotel = () => {
    if (hotelForm.name && hotelForm.city) {
      setPricingTouched(true);
      if (editingHotelId) {
        setAccommodations(
          accommodations.map((h) =>
            h.id === editingHotelId ? { ...hotelForm, id: editingHotelId } : h,
          ),
        );
      } else {
        setAccommodations([
          ...accommodations,
          { ...hotelForm, id: Date.now() },
        ]);
      }

      setHotelForm({
        hotelId: null,
        name: "",
        city: "",
        category: "4 Star",
        roomType: "Deluxe",
        checkIn: "",
        checkOut: "",
        rooms: "1",
        cnbCount: "0",
        extraBeds5To12Count: "0",
        extraBedsAbove12Count: "0",
        extraAdultCount: "0",
        mealPlan: "",
        pricePerRoom: "",
        bedPrices: [],
        photo: null,
        cancelled: false,
        cancellationCharge: "",
        cancellationNote: "",
        alternateOptions: [],
        markupPercentage: "",
      });
      setEditingHotelId(null);
      setIsHotelModalOpen(false);
    }
  };

  const handleAddTransport = () => {
    if (transportForm.route && transportForm.date) {
      setPricingTouched(true);
      if (editingTransportId) {
        setTransportation(
          transportation.map((t) =>
            t.id === editingTransportId
              ? { ...transportForm, id: editingTransportId }
              : t,
          ),
        );
      } else {
        setTransportation([
          ...transportation,
          { ...transportForm, id: Date.now() },
        ]);
      }

      setTransportForm({
        vehicleId: null,
        tripType: "Transfer",
        route: "",
        destination: "",
        date: "",
        vehicleType: "",
        quantity: 1,
        remarks: "",
        markupPercentage: "",
      });
      setEditingTransportId(null);
      setIsTransportModalOpen(false);
    }
  };

  const openNewActivityModal = () => {
    setActivityForm(blankActivityForm());
    setEditingActivityId(null);
    setIsActivityModalOpen(true);
  };

  const handleAddActivity = () => {
    if (activityForm.name && activityForm.pricePerTicket !== "") {
      setPricingTouched(true);
      if (editingActivityId) {
        setTripActivities(
          tripActivities.map((a) =>
            a.id === editingActivityId
              ? { ...activityForm, id: editingActivityId }
              : a,
          ),
        );
      } else {
        setTripActivities([
          ...tripActivities,
          { ...activityForm, id: Date.now() },
        ]);
      }

      setActivityForm(blankActivityForm());
      setEditingActivityId(null);
      setIsActivityModalOpen(false);
    }
  };

  const openEditHotelModal = (hotel) => {
    const normalizedHotel = normalizeAccommodation(hotel);

    setHotelForm({
      id: normalizedHotel.id,
      hotelId: normalizedHotel.hotelId,
      name: normalizedHotel.name,
      city: normalizedHotel.city,
      category: normalizedHotel.category,
      checkIn: normalizedHotel.checkIn,
      checkOut: normalizedHotel.checkOut,
      rooms: normalizedHotel.rooms || "1",
      cnbCount: normalizedHotel.cnbCount || "0",
      extraBeds5To12Count: normalizedHotel.extraBeds5To12Count || "0",
      extraBedsAbove12Count: normalizedHotel.extraBedsAbove12Count || "0",
      extraAdultCount: normalizedHotel.extraAdultCount || "0",
      mealPlan: normalizedHotel.mealPlan,
      roomType: normalizedHotel.roomType || "Deluxe",
      pricePerRoom: normalizedHotel.pricePerRoom || "",
      bedPrices: normalizedHotel.bedPrices || [],
      photo: normalizedHotel.photo,
      cancelled: !!normalizedHotel.cancelledAt,
      cancellationCharge: normalizedHotel.cancellationCharge ?? "",
      cancellationNote: normalizedHotel.cancellationNote ?? "",
      alternateOptions: normalizedHotel.alternateOptions || [],
      markupPercentage: normalizedHotel.markupPercentage ?? "",
    });
    setEditingHotelId(hotel.id);
    setIsHotelModalOpen(true);
  };

  const openEditTransportModal = (transport) => {
    setTransportForm({
      id: transport.id,
      vehicleId: transport.vehicleId,
      tripType: transport.tripType || "Transfer",
      route: transport.route,
      destination: transport.destination || "",
      date: transport.date,
      vehicleType: transport.vehicleType,
      quantity: transport.quantity || 1,
      remarks: transport.remarks,
      markupPercentage: transport.markupPercentage ?? "",
    });
    setEditingTransportId(transport.id);
    setIsTransportModalOpen(true);
  };

  const openEditActivityModal = (activity) => {
    setActivityForm({
      id: activity.id,
      activityId: activity.activityId,
      name: activity.name,
      location: activity.location || "",
      dayNumber: activity.dayNumber ?? "",
      ticketCount: activity.ticketCount || "1",
      childCount: activity.childCount ?? "0",
      pricePerTicket: activity.pricePerTicket ?? "",
      childPrice: activity.childPrice ?? "",
      costPerTicket: activity.costPerTicket ?? "",
      childCost: activity.childCost ?? "",
      rateOption: activity.rateOption || "",
      city: activity.city || "",
      date: dateForDay(tripInfo.startDate, activity.dayNumber),
      photo: activity.photo || null,
      markupPercentage: activity.markupPercentage ?? "",
      notes: activity.notes || "",
    });
    setEditingActivityId(activity.id);
    setIsActivityModalOpen(true);
  };

  const removeAccommodation = (id) => {
    setPricingTouched(true);
    setAccommodations(accommodations.filter((hotel) => hotel.id !== id));
  };

  const removeTransportation = (id) => {
    setPricingTouched(true);
    setTransportation(transportation.filter((item) => item.id !== id));
  };

  const removeActivity = (id) => {
    setPricingTouched(true);
    setTripActivities(tripActivities.filter((item) => item.id !== id));
  };

  // Pricing Calculation logic
  const calculateHotelCost = (item) => {
    // A cancelled stay shouldn't count toward the live trip total.
    if (item.cancelled || item.cancelledAt) return 0;

    // "Similar Options": when alternate hotels are attached to this slot,
    // the client-facing price is the highest of all options shown — protects
    // margin regardless of which one the client ends up picking.
    const altPrices = (item.alternateOptions || []).map((o) => parseFloat(o.price || 0));
    const basePrice = Math.max(parseFloat(item.pricePerRoom || 0), ...altPrices, 0);
    const rooms = parseInt(item.rooms || 1);
    const cnbCount = parseInt(item.cnbCount || 0);
    const extraBeds5To12Count = parseInt(item.extraBeds5To12Count || 0);
    const extraBedsAbove12Count = parseInt(item.extraBedsAbove12Count || 0);
    const extraAdultCount = parseInt(item.extraAdultCount || 0);

    // Calculate nights
    let nights = 1;
    if (item.checkIn && item.checkOut) {
      try {
        const parseDate = (dateStr) => {
          if (!dateStr) return null;
          // Handles d-m-Y (DatePicker) and Y-m-d (Fallback)
          const parts = dateStr.includes("-") ? dateStr.split("-") : [];
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // Y-m-d
              return new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
              // d-m-Y
              return new Date(parts[2], parts[1] - 1, parts[0]);
            }
          }
          return new Date(dateStr);
        };

        const start = parseDate(item.checkIn);
        const end = parseDate(item.checkOut);

        if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffTime = Math.abs(end - start);
          nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        } else {
          nights = 1;
        }
      } catch (e) {
        console.warn("Nights calculation failed:", e);
        nights = 1;
      }
    }

    const roomSubtotal = basePrice * rooms * nights;

    // Extra bed calculation
    let totalExtraBed5To12Cost = 0;
    let totalExtraBedAbove12Cost = 0;
    let totalCnbCost = 0;
    let totalExtraAdultCost = 0;

    if (item.bedPrices && Array.isArray(item.bedPrices)) {
      const cnbPriceEntry = item.bedPrices.find((bp) => bp.category === "cnb");
      const extraBed5To12PriceEntry = item.bedPrices.find(
        (bp) => bp.category === "5_to_12",
      );
      const extraBedAbove12PriceEntry = item.bedPrices.find(
        (bp) => bp.category === "above_12",
      );
      const extraAdultPriceEntry = item.bedPrices.find(
        (bp) => bp.category === "extra_adult",
      );
      const cnbPrice = parseFloat(cnbPriceEntry?.price || 0);
      const extraBed5To12Price = parseFloat(
        extraBed5To12PriceEntry?.price || 0,
      );
      const extraBedAbove12Price = parseFloat(
        extraBedAbove12PriceEntry?.price || 0,
      );
      const extraAdultPrice = parseFloat(extraAdultPriceEntry?.price || 0);
      totalExtraBed5To12Cost =
        extraBed5To12Price * extraBeds5To12Count * nights;
      totalExtraBedAbove12Cost =
        extraBedAbove12Price * extraBedsAbove12Count * nights;
      totalCnbCost = cnbPrice * cnbCount * nights;
      totalExtraAdultCost = extraAdultPrice * extraAdultCount * nights;
    }

    return (
      roomSubtotal +
      totalExtraBed5To12Cost +
      totalExtraBedAbove12Cost +
      totalCnbCost +
      totalExtraAdultCost
    );
  };

  const calculateVehicleCost = (item) => {
    const vehicle = availableVehicles.find((v) => v.id === item.vehicleId);
    if (!vehicle) return 0;
    const price = parseFloat(vehicle.price || 0);
    return price * (item.quantity || 1);
  };

  const calculateActivityCost = (item) => tripActivityTotal(item);

  const totalHotelCost = accommodations.reduce(
    (sum, item) => sum + calculateHotelCost(item),
    0,
  );
  const totalVehicleCost = transportation.reduce(
    (sum, item) => sum + calculateVehicleCost(item),
    0,
  );
  const totalActivityCost = tripActivities.reduce(
    (sum, item) => sum + calculateActivityCost(item),
    0,
  );
  const totalOtherCost = otherCosts.reduce(
    (sum, item) => sum + parseFloat(item.price || 0),
    0,
  );

  // Per-item markup override falls back to the trip-wide margin when unset —
  // this is what lets one hotel/vehicle carry a different margin than the
  // rest of the trip without touching the raw cost totals shown above.
  const effectiveMarkup = (item) =>
    item.markupPercentage !== undefined &&
    item.markupPercentage !== null &&
    item.markupPercentage !== ""
      ? parseFloat(item.markupPercentage) || 0
      : profitMarginPercentage || 0;

  // Marked-up (client-facing) totals, used only for the grand total below —
  // by the distributive property this equals totalHotelCost*(1+margin%) etc.
  // when no item overrides the trip margin, so the final total is unchanged
  // for every existing trip.
  const totalHotelCostMarkedUp = accommodations.reduce(
    (sum, item) => sum + calculateHotelCost(item) * (1 + effectiveMarkup(item) / 100),
    0,
  );
  const totalVehicleCostMarkedUp = transportation.reduce(
    (sum, item) => sum + calculateVehicleCost(item) * (1 + effectiveMarkup(item) / 100),
    0,
  );
  const totalActivityCostMarkedUp = tripActivities.reduce(
    (sum, item) => sum + calculateActivityCost(item) * (1 + effectiveMarkup(item) / 100),
    0,
  );
  const totalOtherCostMarkedUp = totalOtherCost * (1 + (profitMarginPercentage || 0) / 100);

  const netCostMarkedUp =
    totalHotelCostMarkedUp + totalVehicleCostMarkedUp + totalActivityCostMarkedUp + totalOtherCostMarkedUp;
  const gstAmountValue = includeGST ? netCostMarkedUp * (gstPercentage / 100) : 0;
  const costWithGst = netCostMarkedUp + gstAmountValue;
  const calculatedTotalCost = costWithGst;

  useEffect(() => {
    // Don't touch the trip's saved cost until the agent has actually edited
    // GST%/margin% themselves — otherwise this fires the instant a trip
    // loads (before its real percentages, if any, have been restored) and
    // silently overwrites its quoted price.
    if (!pricingTouched) return;
    const nextCost = Math.max(0, Math.round(calculatedTotalCost)).toString();
    setTripInfo((prev) =>
      prev.cost === nextCost
        ? prev
        : {
            ...prev,
            cost: nextCost,
          },
    );
  }, [calculatedTotalCost, pricingTouched]);

  const removeDay = (id) => {
    const updatedItinerary = itinerary
      .filter((day) => day.id !== id)
      .map((day, index) => ({
        ...day,
        day: index + 1,
      }));
    setItinerary(updatedItinerary);
  };

  const addDay = () => {
    const nextDay = itinerary.length + 1;
    setItinerary([
      ...itinerary,
      {
        id: Date.now(),
        day: nextDay,
        title: `Day ${nextDay}: New Destination`,
        description: "",
        photo: null,
      },
    ]);
  };

  const addDayFromDestination = (dest) => {
    const nextDay = itinerary.length + 1;
    const activityLabels = destinationActivityLabels(dest.activities);
    setItinerary([
      ...itinerary,
      {
        id: Date.now(),
        day: nextDay,
        title: `Day ${nextDay}: ${dest.name}`,
        destination: dest.name,
        destinationId: dest.id,
        location: dest.name, // Auto-fill location from destination
        description: activityLabels.join("\n"),
        activities: activityLabels,
        photo: dest.image_path || null,
      },
    ]);
  };

  // ── Open-trip tabs (assistant-style multi-tab workspace) ───────────────
  const [tabs, setTabs] = useState(() => readTabs());
  const [autoState, setAutoState] = useState("idle"); // idle | saving | saved
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const builderBase = isPackageMode ? "/package-builder" : "/trip-builder";
  const draftStorageKey = `${DRAFT_KEY}:${draftKey}`;
  const currentTabId = urlTripId || `draft:${draftKey}`;
  const defaultTabTitle = isPackageMode ? "New Package" : "New Trip";
  const currentTitle =
    (tripInfo.tripTitle || tripInfo.clientName || "").trim() || defaultTabTitle;

  useEffect(() => {
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
    } catch (e) {
      /* ignore */
    }
  }, [tabs]);

  // keep the current trip present in the tab strip with a fresh title.
  // Only trust the form-derived title once the loaded data belongs to this tab,
  // otherwise a freshly opened tab briefly shows the previous trip's name.
  const dataIsCurrent = loadedTabId === currentTabId;
  const isDraftTab = String(currentTabId).startsWith("draft:");
  useEffect(() => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === currentTabId);
      if (idx === -1) {
        const initial = dataIsCurrent
          ? currentTitle
          : isDraftTab
            ? defaultTabTitle
            : "Loading…";
        return [...prev, { id: currentTabId, title: initial }];
      }
      if (!dataIsCurrent) return prev; // keep title until this tab's data settles
      if (prev[idx].title === currentTitle) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], title: currentTitle };
      return next;
    });
  }, [currentTabId, currentTitle, dataIsCurrent, isDraftTab, defaultTabTitle]);

  const gotoTab = (tab) => {
    if (typeof tab.id === "string" && tab.id.startsWith("draft:")) {
      const key = tab.id.slice(6);
      navigate(key === "default" ? builderBase : `${builderBase}?d=${key}`);
    } else {
      navigate(`${builderBase}/${tab.id}`);
    }
  };

  const openTab = (tab) => {
    if (tab.id !== currentTabId) gotoTab(tab);
  };

  const closeTab = (tab, e) => {
    if (e) e.stopPropagation();
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tab.id);
      if (tab.id === currentTabId) {
        const fallback = next[next.length - 1];
        setTimeout(
          () => (fallback ? gotoTab(fallback) : navigate("/my-trips")),
          0,
        );
      }
      return next;
    });
  };

  // when a brand-new trip is first saved, promote its draft tab to the real id
  const replaceNewTab = (newId) => {
    setTabs((prev) =>
      prev
        .filter((t) => t.id !== newId)
        .map((t) =>
          t.id === currentTabId ? { id: newId, title: currentTitle } : t,
        ),
    );
    try {
      localStorage.removeItem(draftStorageKey);
    } catch (e) {
      /* ignore */
    }
  };

  const saveTrip = async ({ silent = false } = {}) => {
    if (isPackageMode) {
      if (!tripInfo.tripTitle) {
        if (!silent) toast.error("Package name is required");
        return false;
      }
    } else {
      if (!tripInfo.clientName) {
        if (!silent) toast.error("Client Name is required");
        return false;
      }
      if (!tripInfo.clientPhone || tripInfo.clientPhone.length < 5) {
        if (!silent) toast.error("Client Phone is required");
        return false;
      }
      if (!tripInfo.clientEmail) {
        if (!silent) toast.error("Client Email is required");
        return false;
      }
    }

    // Format data for backend (plural names and snake_case for items)
    const formattedItineraries = itinerary.map((item) => ({
      id: typeof item.id === "number" && item.id > 1000000000 ? null : item.id, // reset client-side IDs
      day_number: item.day,
      title: item.title,
      location: item.location,
      destination_id: item.destinationId,
      description: (item.activities || []).join("\n"),
      image: item.photo, // backend expects 'image' for base64
    }));

    const formattedAccommodations = accommodations.map((item) => ({
      id: typeof item.id === "number" && item.id > 1000000000 ? null : item.id,
      hotelId: item.hotelId,
      name: item.name,
      city: item.city,
      category: item.category,
      rooms: item.rooms,
      cnb_count: item.cnbCount || "0",
      extra_beds_5_to_12_count: item.extraBeds5To12Count || "0",
      extra_beds_above_12_count: item.extraBedsAbove12Count || "0",
      extra_adult_count: item.extraAdultCount || "0",
      meal_plan: item.mealPlan,
      room_type: item.roomType || "Deluxe",
      price_per_room: item.pricePerRoom,
      bed_prices: item.bedPrices,
      check_in: item.checkIn,
      check_out: item.checkOut,
      image: item.photo,
      cancelled_at: item.cancelled ? item.cancelledAt || new Date().toISOString() : null,
      cancellation_charge: item.cancellationCharge === "" ? null : item.cancellationCharge,
      cancellation_note: item.cancellationNote ?? null,
      alternate_options: item.alternateOptions ?? [],
      markup_percentage: item.markupPercentage === "" ? null : item.markupPercentage,
    }));

    const formattedTransportations = sortedTransportation.map((item, index) => {
      // Calculate Day number based on date for consistent export
      const uniqueDates = [
        ...new Set(sortedTransportation.map((t) => t.date).filter(Boolean)),
      ].sort((a, b) => new Date(a) - new Date(b));

      const dayNumber = item.date
        ? uniqueDates.indexOf(item.date) + 1
        : index + 1;

      return {
        id:
          typeof item.id === "number" && item.id > 1000000000 ? null : item.id,
        vehicleId: item.vehicleId,
        trip_type: item.tripType,
        destination: item.destination,
        route: item.route,
        date: item.date,
        vehicle_type: item.vehicleType,
        quantity: item.quantity || 1,
        remarks: item.remarks,
        day_number: dayNumber, // Include day_number for PDF rendering
        markup_percentage: item.markupPercentage === "" ? null : item.markupPercentage,
      };
    });

    const formattedTripActivities = tripActivities.map((item) => ({
      id: typeof item.id === "number" && item.id > 1000000000 ? null : item.id,
      activity_id: item.activityId,
      name: item.name,
      location: item.location || null,
      day_number: item.dayNumber === "" ? null : item.dayNumber,
      ticket_count: item.ticketCount || 1,
      price_per_ticket: item.pricePerTicket,
      child_count: parseInt(item.childCount, 10) || 0,
      child_price: item.childPrice === "" || item.childPrice == null ? null : item.childPrice,
      cost_per_ticket: item.costPerTicket === "" || item.costPerTicket == null ? null : item.costPerTicket,
      child_cost: item.childCost === "" || item.childCost == null ? null : item.childCost,
      rate_option: item.rateOption || null,
      markup_percentage: item.markupPercentage === "" ? null : item.markupPercentage,
      notes: item.notes ?? null,
    }));

    const fullTripData = {
      ...tripInfo,
      include_gst: includeGST,
      gst_amount: includeGST ? Number(gstAmountValue.toFixed(2)) : 0,
      gst_percentage: gstPercentage,
      profit_margin_percentage: profitMarginPercentage,
      use_flight: tripInfo.useFlight,
      transport_details: (tripInfo.transportDetails || []).map((t) => ({
        ...t,
        departure_date_time: t.departureDateTime,
        arrival_date_time: t.arrivalDateTime,
      })),
      itineraries: formattedItineraries,
      accommodations: formattedAccommodations,
      transportations: formattedTransportations,
      trip_activities: formattedTripActivities,
      other_costs: otherCosts.filter((c) => c.name && c.price > 0),
      inclusions,
      exclusions,
      // Status is managed in My Trips / by payments, not here: a new trip
      // starts pending, and updates leave the saved status alone (a stale
      // loaded status must not undo a confirmation that happened meanwhile).
      ...(urlTripId ? { status: undefined } : { status: "pending" }),
    };

    try {
      if (silent) setAutoState("saving");
      else setSaving(true);
      if (isPackageMode) {
        const packageData = { ...fullTripData, locked: !!tripInfo.locked };
        if (urlTripId) {
          await updatePackage(token, urlTripId, packageData);
          if (!silent) toast.success("Package updated successfully!");
        } else {
          const created = await createPackage(token, packageData);
          if (!silent) toast.success("Package saved successfully!");
          localStorage.removeItem(draftStorageKey);
          if (created && created.trip_id) {
            replaceNewTab(created.trip_id);
            navigate(`/package-builder/${created.trip_id}`, { replace: true });
          }
        }
      } else if (urlTripId) {
        // If we have a URL tripId, we are updating.
        await updateTrip(token, urlTripId, fullTripData);
        if (!silent) toast.success("Trip updated successfully!");
      } else {
        const createdTrip = await createTrip(token, fullTripData);
        if (!silent) toast.success("Trip saved successfully!");

        // Clear draft when successfully saved as a new trip
        localStorage.removeItem(draftStorageKey);

        // Promote the "new" tab and navigate so subsequent saves/exports work
        if (createdTrip && createdTrip.trip_id) {
          replaceNewTab(createdTrip.trip_id);
          navigate(embedded ? `/assistant?trip=${createdTrip.trip_id}` : `/trip-builder/${createdTrip.trip_id}`, { replace: true });
        }
      }
      setAutoState("saved");
      setLastSavedAt(Date.now());
      invalidateChingMemory(); // a saved trip teaches Ching new habits
      return true;
    } catch (err) {
      console.error("Save failed:", err);
      if (!silent)
        toast.error(err.message || "Failed to save trip to database.");
      setAutoState("idle");
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleSaveTrip = () => {
    // Saving by hand is the agent's own go-ahead for a voice-filled draft.
    if (chingDraft.current) {
      chingDraft.current = null;
      window.dispatchEvent(new CustomEvent("ching:draft-settled"));
    }
    return saveTrip();
  };

  // ── Auto-save: debounced silent save on any change ─────────────────────
  // A trip Ching filled by voice that the agent hasn't confirmed yet:
  // { meta, base } (see utils/ching/tripDraft.js). Nothing autosaves while it's set.
  const chingDraft = useRef(null);
  const saveRef = useRef(saveTrip);
  saveRef.current = saveTrip;
  const savingRef = useRef(false);
  savingRef.current = saving || loading;
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      // Not mid-sentence (a live voice session is still reshaping the trip), and
      // not while a voice-filled trip waits on Confirm & Build in Ching.
      if (!savingRef.current && !chingLive.current && !chingDraft.current) saveRef.current?.({ silent: true });
    }, 2500);
    return () => clearTimeout(t);
  }, [
    tripInfo,
    itinerary,
    accommodations,
    transportation,
    otherCosts,
    inclusions,
    exclusions,
    includeGST,
    gstPercentage,
    profitMarginPercentage,
    loading,
  ]);

  const handleExport = async () => {
    try {
      setExporting(true);
      // WYSIWYG: export exactly what the live preview shows (any template).
      const { exportPreviewToPdf } = await import("../../utils/exportPdf");
      await exportPreviewToPdf(`${tripInfo.tripId || "Trip"}_Itinerary.pdf`);
      logSendForAmendmentHistory("export");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("There was an error generating your PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Log a "sent" event for the amendment history — only meaningful once the
  // trip actually has a saved server-side record (urlTripId). Fire-and-forget:
  // a logging failure shouldn't block or fail the export/share the agent is
  // actually waiting on.
  const logSendForAmendmentHistory = (trigger) => {
    if (!urlTripId) return;
    logTripSend(token, urlTripId, trigger).catch((err) =>
      console.warn("Failed to log amendment history:", err),
    );
  };

  // ── What's still missing (live): header badge, tab dots, and what Ching reads out.
  const pendingItems = useMemo(
    () =>
      loading
        ? []
        : tripChecklist(
            { tripInfo, itinerary, accommodations, transportation, tripActivities },
            { packageMode: isPackageMode },
          ),
    [loading, tripInfo, itinerary, accommodations, transportation, tripActivities, isPackageMode],
  );
  const pendingCounts = useMemo(() => pendingByTab(pendingItems), [pendingItems]);

  // ── Ching: PDF helpers shared by the voice hand-off and voice commands.
  const exportPreviewBlob = async () => {
    const { exportPreviewToPdfBlob } = await import("../../utils/exportPdf");
    return exportPreviewToPdfBlob();
  };
  // Emails `blob` to the signed-in user. Too big to upload (Vercel's 4.5 MB
  // body cap) → the server renders its own copy from the saved trip.
  const emailBlobToMe = async (tripId, blob) => {
    const pdfBase64 =
      blob && blob.size <= 3 * 1024 * 1024
        ? await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
        : null;
    return emailItineraryToMe(token, tripId, {
      pdfBase64,
      filename: `${tripId}_Itinerary.pdf`,
    });
  };

  // ── Client proposal link (/p/:token): the client opens the itinerary,
  // approves it or asks for changes; the chip in the header shows where it is.
  const [proposal, setProposal] = useState(null);
  const refreshProposal = useCallback(async () => {
    if (!urlTripId || isPackageMode || !token) {
      setProposal(null);
      return;
    }
    try {
      setProposal(await fetchProposal(token, urlTripId));
    } catch {
      /* status chip is optional — never block the builder on it */
    }
  }, [token, urlTripId, isPackageMode]);
  useEffect(() => {
    refreshProposal();
    // Pick up the client's answer when the agent comes back to this tab.
    window.addEventListener("focus", refreshProposal);
    return () => window.removeEventListener("focus", refreshProposal);
  }, [refreshProposal]);

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  /**
   * Share the client link. channel: "whatsapp" | "email" | "link" (copy) |
   * "preview". purpose: "proposal" (approval link), "payment" (the link's
   * payment section) or "remind" (with kind "proposal" | "payment").
   * `popup` is a window opened synchronously in the click handler (browsers
   * block window.open after an await); without one (e.g. a voice command) we
   * try to open and fall back to a clickable toast. Resolves to { message, url }.
   */
  const shareProposal = async (channel, { popup = null, purpose = "proposal", kind = "proposal" } = {}) => {
    // The link shows the SAVED trip, so persist the latest edits first.
    if (!(await saveTrip({ silent: true }))) {
      throw new Error("Save the trip first — client name, phone and email are required.");
    }
    const tripId = urlTripId;
    if (!tripId) throw new Error("Trip saved — send it again to share the link.");
    const forPayment = purpose === "payment" || (purpose === "remind" && kind === "payment");

    // Reminder / payment emails go through the server (and count toward the
    // automatic follow-up limits, so the client isn't nudged twice).
    if (channel === "email" && purpose !== "proposal") {
      const res = await sendReminderApi(token, tripId, forPayment ? "payment" : "proposal");
      refreshProposal();
      return {
        message: purpose === "payment" ? `Payment link emailed to ${res.sent_to}.` : `Reminder emailed to ${res.sent_to}.`,
      };
    }
    if (channel === "email") {
      const blob = await exportPreviewBlob();
      const res = await sendProposalApi(token, tripId, {
        send: "email",
        pdf_base64: blob.size <= 3 * 1024 * 1024 ? await blobToBase64(blob) : null,
      });
      setProposal(res);
      return { message: `Proposal emailed to ${res.sent_to}.`, url: `${window.location.origin}${res.path}` };
    }

    const res = await sendProposalApi(token, tripId, channel === "whatsapp" && purpose === "proposal" ? { send: "whatsapp" } : {});
    setProposal(res);
    const url = `${window.location.origin}${res.path}${forPayment ? "#pay" : ""}`;

    if (channel === "link") {
      const what = forPayment ? "Payment link" : "Approval link";
      try {
        await navigator.clipboard.writeText(url);
        return { message: `${what} copied.`, url };
      } catch {
        return { message: `${what}: ${url}`, url };
      }
    }

    let target = url + (channel === "preview" ? "?preview=1" : "");
    if (channel === "whatsapp") {
      const name = tripInfo.clientName || "there";
      const trip = tripInfo.tripTitle || "trip";
      const agency = agencySettings.agencyName || "us";
      const text =
        purpose === "payment"
          ? `Hi ${name}, you can pay for your ${trip} trip securely here: ${url}`
          : purpose === "remind" && forPayment
            ? `Hi ${name}, a gentle reminder about the pending payment for your ${trip} trip. You can pay securely here: ${url}`
            : purpose === "remind"
              ? `Hi ${name}, just checking in — did you get a chance to look at your ${trip} itinerary from ${agency}? You can view and approve it here: ${url}`
              : `Hi ${name}, your ${trip} itinerary from ${agency} is ready. You can view it and approve it here: ${url}`;
      const phone = (tripInfo.clientPhone || "").replace(/[^\d]/g, "");
      target = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
      logSendForAmendmentHistory("whatsapp_share");
    }
    const win = popup || window.open(target, "_blank", "noopener,noreferrer");
    if (popup) popup.location.href = target;
    if (!win) {
      toast.info(
        <a href={target} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
          {channel === "whatsapp" ? "Tap to open WhatsApp and send it" : "Tap to open the client view"}
        </a>,
        { autoClose: false },
      );
    }
    return {
      message:
        channel === "whatsapp"
          ? `WhatsApp opened with the ${forPayment ? "payment" : purpose === "remind" ? "reminder" : "approval"} link.`
          : "Opened the client view.",
      url,
    };
  };

  const handleShareProposal = async (channel, opts = {}) => {
    setOpenMenu(null);
    // Open the tab now, inside the click, so it isn't popup-blocked later.
    const popup = channel === "whatsapp" || channel === "preview" ? window.open("about:blank", "_blank") : null;
    if (popup) popup.opener = null;
    setSharing(true);
    try {
      const { message } = await shareProposal(channel, { ...opts, popup });
      toast.success(message);
    } catch (err) {
      popup?.close();
      toast.error(err.message || "Couldn't send it.");
    } finally {
      setSharing(false);
    }
  };

  // What a reminder is about right now: payment once the client approved.
  const reminderKind = proposal?.response === "approved" ? "payment" : "proposal";

  const handleExportExcel = async () => {
    setOpenMenu(null);
    try {
      setExporting(true);
      // The workbook is built from the saved trip — persist the latest edits.
      if (!(await saveTrip({ silent: true })) || !urlTripId) {
        throw new Error("Save the trip first — client name, phone and email are required.");
      }
      const blob = await downloadQuotationExcel(token, urlTripId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${urlTripId}_Quotation.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      toast.error(err.message || "Couldn't export the Excel quotation.");
      throw err;
    } finally {
      setExporting(false);
    }
  };

  const proposalChip = (() => {
    if (!proposal || !proposal.token) return null;
    const when = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");
    let label;
    let tone = "bg-black/[0.04] text-[#5b6472]";
    if (proposal.response === "approved") {
      label = `Approved${proposal.responder ? ` by ${proposal.responder}` : ""} · ${when(proposal.responded_at)}`;
      tone = "bg-emerald-50 text-emerald-700";
    } else if (proposal.response === "changes_requested") {
      label = `Changes requested · ${when(proposal.responded_at)}`;
      tone = "bg-amber-50 text-amber-700";
    } else if (proposal.viewed_at) {
      label = `Client viewed${proposal.view_count > 1 ? ` ${proposal.view_count}×` : ""}`;
    } else if (proposal.sent_at) {
      label = `Sent ${when(proposal.sent_at)}`;
    } else {
      return null;
    }
    return (
      <button
        type="button"
        onClick={() => {
          if (proposal.message) toast.info(`Client: “${proposal.message}”`, { autoClose: 10000 });
        }}
        title={proposal.message ? `Client: ${proposal.message}` : "Client proposal status"}
        className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${tone}`}
      >
        <CheckCircle className="w-3.5 h-3.5" />
        {label}
      </button>
    );
  })();

  // ── Ching voice editing: expose this trip to the Ching widget while it's
  // open. Edits run through editTrip.js against a snapshot of the builder's
  // own state and are committed back through the normal setters, so the
  // preview, pricing and autosave all react exactly as for a manual edit.
  const chingState = useRef({});
  chingState.current = {
    snapshot: {
      tripInfo,
      itinerary,
      accommodations,
      transportation,
      tripActivities,
      inclusions,
      exclusions,
      profitMarginPercentage,
      gstPercentage,
      includeGST,
    },
    catalog: {
      hotels: masterHotels,
      destinations: availableDestinations,
      vehicles: availableVehicles,
      activities: availableActivities,
      // What Ching has learned / been told (utils/ching/memoryStore.js) and
      // the agency's standard inclusion lines (Policies page).
      memory: getChingMemory(),
      standard: { inclusions: standardInclusions, exclusions: standardExclusions },
    },
    settings: {
      gst_percentage: gstPercentage,
      profit_percentage: profitMarginPercentage,
      include_gst: includeGST,
      // Ching's "quote ₹45,000" / "margin ₹10,000" / "what's my profit"
      // price a (planned) trip with the builder's own cost calculators.
      priceOf: (snap) =>
        priceBreakdown({
          items: [
            ...(snap.accommodations || []).map((h) => ({ cost: calculateHotelCost(h), markup: h.markupPercentage })),
            ...(snap.transportation || []).map((t) => ({ cost: calculateVehicleCost(t), markup: t.markupPercentage })),
            ...(snap.tripActivities || []).map((a) => ({ cost: calculateActivityCost(a), markup: a.markupPercentage })),
          ],
          other: totalOtherCost,
          marginPct: snap.profitMarginPercentage,
          gstPct: snap.gstPercentage,
          includeGST: snap.includeGST !== false,
        }),
    },
    label: `${currentTitle}${urlTripId ? ` · ${urlTripId}` : ""}`,
    urlTripId,
    saveTrip,
    handleExport,
    handleExportExcel,
    shareProposal,
    pendingItems,
    setActiveTab,
    currencySymbol: (tripInfo.currency || "").includes("₹") || /INR/.test(tripInfo.currency || "") ? "₹" : "",
  };
  const chingUndo = useRef([]);
  // Live (real-time) voice session: { base } = the trip as it was when the
  // agent started speaking; every update re-plans base + all text so far.
  const chingLive = useRef(null);
  useEffect(() => {
    if (loading || !dataIsCurrent) return undefined;
    chingUndo.current = []; // undo history belongs to the trip it was made on
    chingLive.current = null;
    chingDraft.current = null;
    const run = (actions) => {
      const { snapshot, catalog, settings } = chingState.current;
      return { before: snapshot, ...applyEditActions(snapshot, actions, { catalog, settings }) };
    };
    // Pending items for a planned snapshot; the total is priced by the builder
    // after the commit, so it isn't "missing" mid-sentence.
    const livePending = (snap) =>
      tripChecklist(snap, { packageMode: isPackageMode }).filter((i) => i.key !== "price");
    const commit = (next) => {
      setPricingTouched(true);
      // The total is derived: keep the builder's current one and let the
      // pricing effect recompute it (a snapshot's `cost` can be stale — e.g.
      // a live session's base — and the effect only re-runs when the total
      // itself changes).
      setTripInfo((prev) => ({ ...next.tripInfo, cost: prev.cost }));
      setItinerary(next.itinerary);
      setAccommodations(next.accommodations);
      setTransportation(next.transportation);
      setTripActivities(next.tripActivities);
      if (Array.isArray(next.inclusions)) setInclusions(next.inclusions);
      if (Array.isArray(next.exclusions)) setExclusions(next.exclusions);
      setProfitMarginPercentage(next.profitMarginPercentage);
      setGstPercentage(next.gstPercentage);
      setIncludeGST(next.includeGST);
    };
    // Let React render the committed edit before capturing the preview.
    const settle = () => new Promise((r) => setTimeout(r, 700));
    // Email needs a saved trip that matches the preview: persist first.
    const saveForEmail = async () => {
      if (!(await chingState.current.saveTrip({ silent: true }))) {
        throw new Error(
          isPackageMode
            ? "Save the package first."
            : "Save the trip first — client name, phone and email are required.",
        );
      }
    };

    return registerChingEditor({
      get tripLabel() {
        return chingState.current.label;
      },
      // The saved trip's id (null for an unsaved draft) — for "email the invoice", "send hotel requests"…
      get tripId() {
        return chingState.current.urlTripId || null;
      },
      getContext: () => buildEditContext(chingState.current.snapshot),
      preview: (actions) => {
        const { changes, warnings } = run(actions);
        return { changes, warnings };
      },
      apply: (actions) => {
        const { before, snapshot, changes, warnings } = run(actions);
        if (changes.length) {
          chingUndo.current = [...chingUndo.current.slice(-19), { before, label: changes.join("; ") }];
          commit(snapshot);
        }
        return { changes, warnings };
      },
      undo: () => {
        const last = chingUndo.current.pop();
        if (!last) return null;
        // Undoing the voice fill itself drops the pending draft with it.
        if (chingDraft.current && last.before === chingDraft.current.base) chingDraft.current = null;
        commit(last.before);
        return last.label;
      },
      canUndo: () => chingUndo.current.length > 0,
      isBlank: () => isBlankTrip(chingState.current.snapshot),
      // What's missing + the total, for Ching's spoken replies (current render).
      summary: () => {
        const { snapshot, pendingItems: pending, currencySymbol } = chingState.current;
        const cost = Number(snapshot.tripInfo.cost) || 0;
        const p = chingState.current.settings.priceOf(snapshot);
        const fmt = (n) => `${currencySymbol}${Math.round(n).toLocaleString("en-IN")}`;
        return {
          // "What's my profit": cost before margin, what the margin earns, GST.
          profit:
            p.base > 0
              ? { cost: fmt(p.base), profit: fmt(p.profit), gst: p.gst > 0 ? fmt(p.gst) : null, total: fmt(p.total), margin: snapshot.profitMarginPercentage }
              : null,
          pending,
          total: cost > 0 ? `${currencySymbol}${cost.toLocaleString("en-IN")}` : null,
          clientName: snapshot.tripInfo.clientName || "",
          title: snapshot.tripInfo.tripTitle || "",
        };
      },
      setTab: (tab) => chingState.current.setActiveTab(tab),
      // The trip as the builder holds it right now (read-only; the AI
      // Assistant page draws its route, summary and progress from it).
      snapshot: () => chingState.current.snapshot,
      // Confirm & Build (utils/ching/tripDraft.js): the pending voice draft,
      // re-read from the builder's current state, so edits since are in it.
      draft: () => (chingDraft.current ? buildTripDraft(chingState.current.snapshot, chingDraft.current.meta) : null),
      confirmDraft: async () => {
        if (!chingDraft.current) return { saved: true };
        const d = buildTripDraft(chingState.current.snapshot, chingDraft.current.meta);
        if (!d.ok) return { saved: false, blocked: d.blocking };
        chingDraft.current = null;
        await settle();
        // Missing phone / email: built, but the builder can't save it yet.
        const saved = await chingState.current.saveTrip({ silent: true });
        return { saved: !!saved };
      },
      cancelDraft: () => {
        const d = chingDraft.current;
        if (!d) return false;
        chingDraft.current = null;
        chingUndo.current = chingUndo.current.slice(0, -1);
        commit(d.base);
        return true;
      },
      // Phase 4: a cheaper version from the agency's own catalog, and add-ons.
      optimize: () => cheaperPlan(chingState.current.snapshot, chingState.current.catalog),
      addOns: () => addOnSuggestions(chingState.current.snapshot, chingState.current.catalog),
      live: {
        active: () => !!chingLive.current,
        begin: () => {
          if (!chingLive.current) chingLive.current = { base: chingState.current.snapshot };
        },
        update: (text) => {
          if (!chingLive.current) chingLive.current = { base: chingState.current.snapshot };
          const { catalog, settings } = chingState.current;
          const plan = planLive(chingLive.current.base, text, { catalog, settings });
          commit(plan.snapshot);
          const { mode, changes, warnings, unrecognized } = plan;
          return { mode, changes, warnings, unrecognized, pending: livePending(plan.snapshot) };
        },
        finish: (text) => {
          const live = chingLive.current || { base: chingState.current.snapshot };
          chingLive.current = null;
          const { catalog, settings } = chingState.current;
          const plan = planLive(live.base, text, { catalog, settings });
          commit(plan.snapshot);
          if (plan.changes.length) {
            chingUndo.current = [
              ...chingUndo.current.slice(-19),
              { before: live.base, label: plan.mode === "fill" ? "voice fill" : plan.changes.join("; ") },
            ];
          }
          // An edit can answer the draft's questions ("day 2 day trip", "gulmarg hotel khyber").
          if (plan.mode === "edit" && chingDraft.current && plan.answered) {
            const meta = chingDraft.current.meta || {};
            chingDraft.current.meta = {
              ...meta,
              answeredDays: [...(meta.answeredDays || []), ...plan.answered.days],
              answeredHotels: meta.answeredHotels || plan.answered.hotels,
            };
          }
          // A new trip filled by voice is a draft until the agent confirms it.
          let draft = null;
          if (plan.mode === "fill" && plan.changes.length) {
            chingDraft.current = { meta: plan.draftMeta || {}, base: live.base };
            draft = buildTripDraft(plan.snapshot, chingDraft.current.meta);
          }
          const { mode, changes, warnings, unrecognized, commands, cancelled } = plan;
          return { mode, changes, warnings, unrecognized, commands, draft, cancelled, pending: livePending(plan.snapshot) };
        },
        cancel: () => {
          const live = chingLive.current;
          chingLive.current = null;
          if (live) commit(live.base);
        },
      },
      exportPdf: async () => {
        await settle();
        await chingState.current.handleExport();
      },
      emailMe: async () => {
        await settle();
        await saveForEmail();
        // A new trip's first save navigates to its real id — use that one.
        await settle();
        const tripId = chingState.current.urlTripId;
        // A brand-new trip's first save reopens the builder under its real id.
        if (!tripId) throw new Error("Trip saved. Say “email it to me” again to send it.");
        const blob = await exportPreviewBlob();
        return emailBlobToMe(tripId, blob);
      },
      save: async () => {
        await settle();
        return chingState.current.saveTrip();
      },
      // channel: "whatsapp" | "email" | "link" → { message, url }
      sendProposal: async (channel) => {
        await settle();
        return chingState.current.shareProposal(channel);
      },
      sendPaymentLink: async (channel = "whatsapp") => {
        await settle();
        return chingState.current.shareProposal(channel, { purpose: "payment" });
      },
      sendReminder: async (kind = "proposal", channel = "email") => {
        await settle();
        return chingState.current.shareProposal(channel, { purpose: "remind", kind });
      },
      exportExcel: async () => {
        await settle();
        await chingState.current.handleExportExcel();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, dataIsCurrent]);

  const openAmendments = async () => {
    setAmendmentsOpen(true);
    if (!urlTripId) return;
    setRevisionsLoading(true);
    try {
      const res = await fetchTripRevisions(token, urlTripId);
      setRevisions(res.data || []);
    } catch (err) {
      console.error("Failed to load amendment history:", err);
      toast.error("Couldn't load amendment history.");
    } finally {
      setRevisionsLoading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    const greeting = `Hi ${tripInfo.clientName || "there"}, here's your itinerary for ${tripInfo.tripTitle || "your trip"} from ${agencySettings.agencyName || "us"}.`;
    try {
      setSharing(true);
      const { exportPreviewToPdfBlob } = await import("../../utils/exportPdf");
      const blob = await exportPreviewToPdfBlob();
      const filename = `${tripInfo.tripId || "Trip"}_Itinerary.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      // Web Share API (mobile Chrome/Safari): opens the native share sheet
      // with WhatsApp as a target and the PDF attached directly — true
      // one-click sharing. Not supported for files on desktop Chrome.
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: tripInfo.tripTitle || "Itinerary",
          text: greeting,
        });
        logSendForAmendmentHistory("whatsapp_share");
        return;
      }

      // Desktop fallback: WhatsApp's web/deep-link only pre-fills text, it
      // can't attach a file — so download the PDF and open a WhatsApp chat
      // with the greeting, and tell the agent to attach the file themselves.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const phone = (tripInfo.clientPhone || "").replace(/[^\d]/g, "");
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`${greeting} PDF downloaded — attach it here.`)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
      toast.info("PDF downloaded — attach it in the WhatsApp chat that just opened.");
      logSendForAmendmentHistory("whatsapp_share");
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("WhatsApp share error:", err);
        toast.error("Couldn't share the itinerary. Please try again.");
      }
    } finally {
      setSharing(false);
    }
  };

  const clearForm = () => {
    if (
      !window.confirm(
        "Clear current form? This will delete any saved draft and reset the form.",
      )
    )
      return;

    try {
      localStorage.removeItem(draftStorageKey);
    } catch (e) {
      console.warn("Failed to remove draft from localStorage:", e);
    }

    // Reset states to initial/new-trip defaults
    setTripInfo({
      tripId: `TRP${Math.floor(100000 + Math.random() * 900000)}`,
      tripTitle: "",
      destination: "",
      destinationId: null,
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      adults: 2,
      kidsUpto5: 0,
      kids5to12: 0,
      startDate: new Date().toISOString().split("T")[0],
      duration: "2",
      cost: "0",
      currency: "INR (₹)",
      image: defaultTripImage || "",
      status: "Draft",
      template: "ModernTemplate",
      useFlight: false,
      transportDetails: [],
    });

    setItinerary([]);
    setAccommodations([]);
    setTransportation([]);
    setTripActivities([]);
    setInclusions([]);
    setExclusions([]);
    setOtherCosts([]);
    setIncludeGST(true);
    setGstPercentage(0);
    setProfitMarginPercentage(0);
    setPolicies({
      termsConditions: "",
      mustHaves: "",
      rolesResponsibilities: "",
      cancellationPolicy: "",
      additionalExpenses: "",
    });

    setActiveTab("Trip Info");
    toast.info("Draft cleared and form reset");
  };

  const [openMenu, setOpenMenu] = useState(null); // "history" | "templates" | null
  const [recentTrips, setRecentTrips] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);

  const toggleMenu = (which) => {
    const next = openMenu === which ? null : which;
    setOpenMenu(next);
    if (next === "history") {
      setMenuLoading(true);
      fetchTrips(token, { per_page: 8 })
        .then((res) => setRecentTrips(res.data || []))
        .catch(() => setRecentTrips([]))
        .finally(() => setMenuLoading(false));
    }
    if (next === "templates") {
      setMenuLoading(true);
      fetchPackages(token, { per_page: 20 })
        .then((res) => setTemplates(res.data || []))
        .catch(() => setTemplates([]))
        .finally(() => setMenuLoading(false));
    }
  };

  const applyTemplate = async (pkg) => {
    setOpenMenu(null);
    const loadingToast = toast.loading("Loading template…");
    try {
      const res = await usePackage(token, pkg.package_id, {});
      const newId = res.trip_id || (res.trip && res.trip.trip_id);
      toast.dismiss(loadingToast);
      if (newId) {
        toast.success("Template loaded");
        navigate(`/trip-builder/${newId}`);
      } else {
        toast.error("Could not load template");
      }
    } catch (e) {
      toast.dismiss(loadingToast);
      toast.error(e.message || "Could not load template");
    }
  };

  const busy = loading || saving || exporting;

  const handleNewTrip = () => {
    // Always open a brand-new blank itinerary in its own tab — instantly.
    const key = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    navigate(`${builderBase}?d=${key}`);
  };

  const tabStrip = (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[40vw]">
        {tabs.map((tab) => {
          const active = tab.id === currentTabId;
          return (
            <div
              key={tab.id}
              onClick={() => openTab(tab)}
              className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                active
                  ? "bg-[#181c22] text-white border-transparent"
                  : "bg-white text-[#181c22]/70 border-black/10 hover:text-[#181c22]"
              }`}
            >
              <span className="max-w-[130px] truncate">{tab.title}</span>
              <button
                onClick={(e) => closeTab(tab, e)}
                className={`grid place-items-center w-4 h-4 rounded-full shrink-0 ${
                  active ? "hover:bg-white/20" : "hover:bg-black/10"
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={handleNewTrip}
        disabled={busy}
        title="New trip"
        className="flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#181c22] hover:bg-black/[0.05] transition-colors disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" /> New
      </button>
    </div>
  );

  const autoSaveChip = (
    <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-[#9aa3b2] mr-1">
      {autoState === "saving" ? (
        <>
          <span className="w-2 h-2 rounded-full bg-[#e7f63c] animate-pulse" />
          Saving…
        </>
      ) : autoState === "saved" ? (
        <>
          <span className="w-2 h-2 rounded-full bg-[#e7f63c]" />
          Saved
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-black/15" />
          Draft
        </>
      )}
    </span>
  );

  const builderNav = (
    <>
      <div className="relative">
        <button
          onClick={() => toggleMenu("history")}
          className="flex items-center gap-2 text-sm font-medium text-[#181c22]/50 hover:text-[#181c22] transition-colors"
        >
          <Clock className="w-4 h-4" /> <span className="hidden sm:inline">History</span>
        </button>
        {openMenu === "history" && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpenMenu(null)}
            />
            <div className="absolute left-0 top-full mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-black/5 shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181c22]/45 border-b border-black/5">
                Recent trips
              </div>
              <div className="max-h-80 overflow-y-auto py-1">
                {menuLoading ? (
                  <div className="px-4 py-3 text-sm text-[#9aa3b2]">Loading…</div>
                ) : recentTrips.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[#9aa3b2]">
                    No saved trips yet
                  </div>
                ) : (
                  recentTrips.map((t) => {
                    const id = t.trip_id || t.tripId;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setOpenMenu(null);
                          navigate(`/trip-builder/${id}`);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors"
                      >
                        <div className="text-sm font-medium text-[#181c22] truncate">
                          {t.trip_title || t.tripTitle || "Untitled Trip"}
                        </div>
                        <div className="text-xs text-[#9aa3b2] truncate">
                          {[t.client_name, t.destination]
                            .filter(Boolean)
                            .join(" · ") || id}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  const builderActions = (
    <>
      {isPackageMode && (
        <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-[#5b6472] select-none cursor-pointer">
          <input
            type="checkbox"
            checked={!!tripInfo.locked}
            onChange={(e) =>
              setTripInfo((prev) => ({ ...prev, locked: e.target.checked }))
            }
            className="accent-[#e7f63c] w-3.5 h-3.5"
          />
          Locked
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu("pending")}
          title={pendingItems.length ? "What's still missing in this trip" : "Everything's filled"}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
            pendingItems.length
              ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {pendingItems.length ? <CircleAlert className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          {pendingItems.length ? `${pendingItems.length} pending` : "Ready"}
        </button>
        {openMenu === "pending" && pendingItems.length > 0 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
            <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-black/5 shadow-xl z-50 overflow-hidden py-1">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181c22]/45">
                Still to fill
              </div>
              {pendingItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setOpenMenu(null);
                    setActiveTab(item.tab);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-black/[0.03] transition-colors flex items-center gap-2.5"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.level === "required" ? "bg-amber-500" : "bg-black/20"}`} />
                  <span className="flex-1 text-sm text-[#181c22]">{item.label}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9aa3b2]">{item.tab}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {proposalChip}
      {urlTripId && (
        <button
          onClick={openAmendments}
          className="px-4 py-2 rounded-full text-xs font-semibold text-[#181c22] border border-black/10 bg-white hover:bg-black/[0.03] transition-colors flex items-center gap-1.5"
        >
          <HistoryIcon className="w-3.5 h-3.5" /> Amendments
        </button>
      )}
      <div className="relative">
        <button
          onClick={() => toggleMenu("export")}
          disabled={loading || saving || exporting}
          className="px-4 py-2 rounded-full text-xs font-semibold text-[#181c22] border border-black/10 bg-white hover:bg-black/[0.03] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <Loader size="sm" text="" inline color="text-[#181c22]" />
              <span>Exporting…</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3 opacity-60" />
            </>
          )}
        </button>
        {openMenu === "export" && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-black/5 shadow-xl z-50 overflow-hidden py-1">
              <button
                onClick={() => {
                  setOpenMenu(null);
                  handleExport();
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors flex items-center gap-3 text-sm font-medium text-[#181c22]"
              >
                <Download className="w-4 h-4 text-[#181c22]/60" /> Itinerary PDF
              </button>
              {!isPackageMode && (
                <button
                  onClick={() => handleExportExcel().catch(() => {})}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors flex items-center gap-3 text-sm font-medium text-[#181c22]"
                >
                  <Download className="w-4 h-4 text-[#181c22]/60" /> Excel quotation
                </button>
              )}
            </div>
          </>
        )}
      </div>
      {isPackageMode ? (
        <button
          onClick={handleShareWhatsApp}
          disabled={loading || saving || exporting || sharing}
          className="px-4 py-2 rounded-full text-xs font-semibold text-[#181c22] border border-black/10 bg-white hover:bg-black/[0.03] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sharing ? (
            <>
              <Loader size="sm" text="" inline color="text-[#181c22]" />
              <span>Sharing…</span>
            </>
          ) : (
            <>
              <MessageCircle className="w-3.5 h-3.5" /> Share
            </>
          )}
        </button>
      ) : (
        <div className="relative">
          <button
            onClick={() => toggleMenu("send")}
            disabled={loading || saving || exporting || sharing}
            className="px-4 py-2 rounded-full text-xs font-semibold text-[#181c22] border border-black/10 bg-white hover:bg-black/[0.03] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sharing ? (
              <>
                <Loader size="sm" text="" inline color="text-[#181c22]" />
                <span>Sending…</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Send <ChevronDown className="w-3 h-3 opacity-60" />
              </>
            )}
          </button>
          {openMenu === "send" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
              <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-black/5 shadow-xl z-50 overflow-hidden py-1">
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181c22]/45">
                  Client approval link
                </div>
                {[
                  { key: "whatsapp", icon: MessageCircle, label: "Send on WhatsApp", hint: "Opens a chat with the link" },
                  { key: "email", icon: Mail, label: "Email to client", hint: tripInfo.clientEmail || "Add the client's email first" },
                  { key: "link", icon: Link2, label: "Copy link" },
                  { key: "preview", icon: Eye, label: "Preview as client" },
                ].map(({ key, icon, label, hint }) => (
                  <button
                    key={key}
                    onClick={() => handleShareProposal(key)}
                    className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors flex items-start gap-3"
                  >
                    {React.createElement(icon, { className: "w-4 h-4 mt-0.5 text-[#181c22]/60" })}
                    <span>
                      <span className="block text-sm font-medium text-[#181c22]">{label}</span>
                      {hint && <span className="block text-xs text-[#9aa3b2] truncate max-w-[13rem]">{hint}</span>}
                    </span>
                  </button>
                ))}
                <div className="border-t border-black/5 my-1" />
                <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181c22]/45">
                  Payment &amp; reminders
                </div>
                {[
                  { key: "pay-wa", icon: MessageCircle, label: "Send payment link on WhatsApp", run: () => handleShareProposal("whatsapp", { purpose: "payment" }) },
                  { key: "pay-copy", icon: Link2, label: "Copy payment link", run: () => handleShareProposal("link", { purpose: "payment" }) },
                  {
                    key: "remind-email",
                    icon: Mail,
                    label: `Email a ${reminderKind} reminder`,
                    run: () => handleShareProposal("email", { purpose: "remind", kind: reminderKind }),
                  },
                  {
                    key: "remind-wa",
                    icon: MessageCircle,
                    label: `WhatsApp a ${reminderKind} reminder`,
                    run: () => handleShareProposal("whatsapp", { purpose: "remind", kind: reminderKind }),
                  },
                ].map(({ key, icon, label, run }) => (
                  <button
                    key={key}
                    onClick={run}
                    className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors flex items-center gap-3 text-sm font-medium text-[#181c22]"
                  >
                    {React.createElement(icon, { className: "w-4 h-4 text-[#181c22]/60" })}
                    {label}
                  </button>
                ))}
                <div className="border-t border-black/5 my-1" />
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    handleShareWhatsApp();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors flex items-center gap-3 text-sm font-medium text-[#181c22]"
                >
                  <Download className="w-4 h-4 text-[#181c22]/60" /> Share the PDF
                </button>
              </div>
            </>
          )}
        </div>
      )}
      <button
        onClick={handleSaveTrip}
        disabled={loading || saving || exporting}
        className="px-4 py-2 rounded-full text-xs font-semibold bg-[#e7f63c] text-[#181c22] hover:bg-[#d4e42e] transition-colors flex items-center gap-1.5 shadow-sm shadow-[#e7f63c]/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader size="sm" text="" inline color="text-[#181c22]" />
            <span>Saving…</span>
          </>
        ) : (
          <>
            <Save className="w-3.5 h-3.5" /> Save
          </>
        )}
      </button>
    </>
  );

  const builderBody = (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Builder Area — two rounded panels (builder + live preview) */}
          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-3 lg:p-4 gap-3 lg:gap-4">
            {/* Left Form — builder panel */}
            <div className="w-full lg:w-[45%] lg:h-full flex flex-col bg-white rounded-[20px] border border-black/5 shadow-sm overflow-hidden shrink-0 lg:shrink">
              <div className="p-6 pb-0 shrink-0">
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  {[
                    { tab: "Trip Info", icon: SettingsIcon },
                    { tab: "Itinerary", icon: Calendar },
                    { tab: "Logistics", icon: Briefcase },
                    { tab: "Pricing", icon: IndianRupee },
                  ].map(({ tab, icon: Icon }) => (
                    <button
                      key={tab}
                      onClick={() => !busy && setActiveTab(tab)}
                      disabled={busy}
                      title={tab}
                      className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-2xl border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        activeTab === tab
                          ? "border-[#181c22] bg-[#181c22] text-white shadow-sm"
                          : "border-black/10 text-[#181c22]/55 hover:text-[#181c22] hover:border-black/20 bg-white"
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                      <span className="whitespace-nowrap">{tab}</span>
                      {pendingCounts[tab] > 0 && (
                        <span
                          className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-[10px] font-bold text-[#181c22] grid place-items-center"
                          title={`${pendingCounts[tab]} pending in ${tab}`}
                        >
                          {pendingCounts[tab]}
                        </span>
                      )}
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      onClick={() => toggleMenu("templates")}
                      title="Load from package template"
                      className="inline-flex items-center gap-2 h-10 px-3.5 rounded-2xl border border-black/10 text-sm font-semibold text-[#181c22]/55 hover:text-[#181c22] hover:border-black/20 bg-white transition-colors"
                    >
                      <PackageIcon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
                      <span className="whitespace-nowrap">Template</span>
                    </button>
                    {openMenu === "templates" && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenu(null)}
                        />
                        <div className="absolute left-0 top-full mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-black/5 shadow-xl z-50 overflow-hidden">
                          <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#181c22]/45 border-b border-black/5">
                            Load from template
                          </div>
                          <div className="max-h-80 overflow-y-auto py-1">
                            {menuLoading ? (
                              <div className="px-4 py-3 text-sm text-[#9aa3b2]">
                                Loading…
                              </div>
                            ) : templates.length === 0 ? (
                              <div className="px-4 py-3 text-sm text-[#9aa3b2]">
                                No package templates yet
                              </div>
                            ) : (
                              templates.map((pkg) => (
                                <button
                                  key={pkg.package_id}
                                  onClick={() => applyTemplate(pkg)}
                                  className="w-full text-left px-4 py-2.5 hover:bg-black/[0.03] transition-colors"
                                >
                                  <div className="text-sm font-medium text-[#181c22] truncate">
                                    {pkg.trip_title || "Untitled Package"}
                                  </div>
                                  <div className="text-xs text-[#9aa3b2] truncate">
                                    {[
                                      pkg.destination,
                                      pkg.duration ? `${pkg.duration} days` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ") || "Template"}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
                    <Loader text="Syncing trip data..." />
                  </div>
                ) : (
                  <>
                    {activeTab === "Trip Info" && (
                      <TripInfoTab
                        tripInfo={tripInfo}
                        setTripInfo={setTripInfo}
                        urlTripId={urlTripId}
                        hotelForm={hotelForm}
                        setHotelForm={setHotelForm}
                        transportForm={transportForm}
                        setTransportForm={setTransportForm}
                        setAccommodations={setAccommodations}
                        setTransportation={setTransportation}
                        calculatedTotalCost={calculatedTotalCost}
                        includeGST={includeGST}
                        setIncludeGST={touchesPricing(setIncludeGST)}
                        navigate={navigate}
                        standardInclusions={standardInclusions}
                        inclusions={inclusions}
                        setInclusions={setInclusions}
                        newInclusion={newInclusion}
                        setNewInclusion={setNewInclusion}
                        addInclusion={addInclusion}
                        editingInclusionIndex={editingInclusionIndex}
                        setEditingInclusionIndex={setEditingInclusionIndex}
                        editingInclusionValue={editingInclusionValue}
                        setEditingInclusionValue={setEditingInclusionValue}
                        saveInclusionEdit={saveInclusionEdit}
                        removeInclusion={removeInclusion}
                        standardExclusions={standardExclusions}
                        exclusions={exclusions}
                        setExclusions={setExclusions}
                        newExclusion={newExclusion}
                        setNewExclusion={setNewExclusion}
                        addExclusion={addExclusion}
                        editingExclusionIndex={editingExclusionIndex}
                        setEditingExclusionIndex={setEditingExclusionIndex}
                        editingExclusionValue={editingExclusionValue}
                        setEditingExclusionValue={setEditingExclusionValue}
                        saveExclusionEdit={saveExclusionEdit}
                        removeExclusion={removeExclusion}
                      />
                    )}

                    {activeTab === "Itinerary" && (
                      <ItineraryTab
                        availableDestinations={availableDestinations}
                        itinerary={itinerary}
                        setItinerary={setItinerary}
                        removeDay={removeDay}
                        addDayFromDestination={addDayFromDestination}
                        formatImageUrl={formatImageUrl}
                      />
                    )}

                    {activeTab === "Logistics" && (
                      <LogisticsTab
                        groupedAccommodations={groupedAccommodations}
                        tripInfo={tripInfo}
                        formatAgeGroupLabel={formatAgeGroupLabel}
                        openEditHotelModal={openEditHotelModal}
                        removeAccommodation={removeAccommodation}
                        setHotelForm={setHotelForm}
                        setEditingHotelId={setEditingHotelId}
                        setIsHotelModalOpen={setIsHotelModalOpen}
                        sortedTransportation={sortedTransportation}
                        openEditTransportModal={openEditTransportModal}
                        removeTransportation={removeTransportation}
                        setTransportForm={setTransportForm}
                        setEditingTransportId={setEditingTransportId}
                        setIsTransportModalOpen={setIsTransportModalOpen}
                        formatImageUrl={formatImageUrl}
                        tripActivities={tripActivities}
                        availableActivities={availableActivities}
                        calculateActivityCost={calculateActivityCost}
                        openEditActivityModal={openEditActivityModal}
                        removeActivity={removeActivity}
                        openNewActivityModal={openNewActivityModal}
                      />
                    )}
                    {activeTab === "Logistics" && !isPackageMode && urlTripId && (
                      <div className="mt-6">
                        <TripBookings token={token} tripId={urlTripId} refreshKey={lastSavedAt} />
                      </div>
                    )}

                    {activeTab === "Pricing" && (
                      <PricingTab
                        totalHotelCost={totalHotelCost}
                        totalVehicleCost={totalVehicleCost}
                        totalActivityCost={totalActivityCost}
                        otherCosts={otherCosts}
                        setOtherCosts={touchesPricing(setOtherCosts)}
                        gstPercentage={gstPercentage}
                        setGstPercentage={handleGstPercentageChange}
                        profitMarginPercentage={profitMarginPercentage}
                        setProfitMarginPercentage={handleProfitMarginPercentageChange}
                        calculatedTotalCost={calculatedTotalCost}
                      />
                    )}
                    {activeTab === "Pricing" && !isPackageMode && urlTripId && (
                      <div className="mt-6">
                        <TripPayments token={token} tripId={urlTripId} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Right Preview — live preview panel */}
            <div className="relative flex-1 lg:h-full overflow-y-auto overflow-x-hidden bg-[#eef0f1] rounded-[20px] border border-black/5 custom-scrollbar min-h-screen lg:min-h-0">
              {loading ? null : (
                <div className="flex flex-col items-center py-8 px-2 sm:px-4 md:px-6">
                  <div className="w-[210mm] shrink-0 transition-all origin-top transform [zoom:0.35] sm:[zoom:0.4] md:[zoom:0.5] lg:[zoom:0.6] xl:[zoom:0.75] 2xl:[zoom:0.9] shadow-2xl">
                    <ModernTemplate
                      key={`${tripInfo.template}-${tripInfo.cost}-${includeGST ? 1 : 0}-${gstPercentage}-${profitMarginPercentage}-${accommodations.length}-${transportation.length}-${tripActivities.length}-${otherCosts.length}`}
                      tripInfo={tripInfo}
                      itinerary={itinerary}
                      accommodations={resolvedAccommodations}
                      transportation={transportation}
                      tripActivities={tripActivities}
                      agencySettings={agencySettings}
                      inclusions={inclusions}
                      exclusions={exclusions}
                      policies={policies}
                      includeGST={includeGST}
                    />
                  </div>
                </div>
              )}

              {/* Live Preview Badge */}
              <div className="absolute bottom-10 right-10 flex items-center gap-2 bg-[#1a1c1c]/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 z-50">
                <div className="w-2 h-2 rounded-full bg-[#e7f63c]"></div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  Live Preview
                </span>
              </div>
            </div>
          </div>
        </div>
  );

  return (
    <>
      {embedded ? (
        // Inside the AI Assistant: just the builder, with its own actions bar.
        <div className="flex flex-col h-full min-h-0 bg-[#f3f3f4] rounded-[24px] border border-black/5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-3 shrink-0">
            {autoSaveChip}
            {builderActions}
          </div>
          <div className="flex-1 min-h-0">{builderBody}</div>
        </div>
      ) : (
        <AssistantFrame
          title={tabStrip}
          nav={builderNav}
          actions={
            <>
              {autoSaveChip}
              {builderActions}
            </>
          }
        >
          {builderBody}
        </AssistantFrame>
      )}

      <HotelModal
        isOpen={isHotelModalOpen}
        onClose={() => setIsHotelModalOpen(false)}
        isEditing={!!editingHotelId}
        onSubmit={handleAddHotel}
        hotelForm={hotelForm}
        setHotelForm={setHotelForm}
        uniqueCities={uniqueCities}
        hotelsInCity={hotelsInCity}
        masterHotels={masterHotels}
        tripInfo={tripInfo}
        urlTripId={urlTripId}
        reservedAccommodationDates={reservedAccommodationDates}
        token={token}
        tripMarginPercentage={profitMarginPercentage}
      />

      <TransportModal
        isOpen={isTransportModalOpen}
        onClose={() => setIsTransportModalOpen(false)}
        isEditing={!!editingTransportId}
        onSubmit={handleAddTransport}
        transportForm={transportForm}
        setTransportForm={setTransportForm}
        availableVehicles={availableVehicles}
        tripInfo={tripInfo}
        urlTripId={urlTripId}
        tripMarginPercentage={profitMarginPercentage}
      />

      <ActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        isEditing={!!editingActivityId}
        onSubmit={handleAddActivity}
        activityForm={activityForm}
        setActivityForm={setActivityForm}
        availableActivities={availableActivities}
        availableDestinations={availableDestinations}
        tripInfo={tripInfo}
        token={token}
        urlTripId={urlTripId}
        tripMarginPercentage={profitMarginPercentage}
      />

      {amendmentsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-8">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setAmendmentsOpen(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-red-500 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-6 flex-shrink-0">
              <h2 className="text-xl font-black text-slate-900">Amendment History</h2>
              <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-wider">
                Every version sent to the client
              </p>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar space-y-4">
              {revisionsLoading ? (
                <Loader size="sm" text="Loading history…" />
              ) : revisions.length === 0 ? (
                <p className="text-sm text-slate-400 font-medium">
                  Nothing sent yet — export, share, or send a confirmation to start the trail.
                </p>
              ) : (
                revisions.map((rev) => (
                  <div key={rev.id} className="border border-black/5 rounded-xl p-4 bg-[#f9f9f9]/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-black text-[#181c22]">
                        Version {rev.version_number}
                      </span>
                      <span className="text-[10px] font-bold text-[#9aa3b2] uppercase tracking-wider">
                        {TRIGGER_LABELS[rev.trigger] || rev.trigger}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9aa3b2] font-medium mb-2">
                      {new Date(rev.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <ul className="list-disc list-inside space-y-1">
                      {(rev.change_summary || []).map((line, idx) => (
                        <li key={idx} className="text-xs text-[#5b6472] font-medium">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TripBuilder;
