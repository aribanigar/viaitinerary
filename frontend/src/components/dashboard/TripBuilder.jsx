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
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  createTrip,
  updateTrip,
  fetchTrips,
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
import { HotelModal, TransportModal } from "./trip-builder/TripBuilderModals";
import TripInfoTab from "./trip-builder/TripInfoTab";
import {
  DRAFT_KEY,
  useTripBuilderData,
} from "./trip-builder/useTripBuilderData";

const TABS_KEY = "builder_open_tabs";
const readTabs = () => {
  try {
    return JSON.parse(localStorage.getItem(TABS_KEY)) || [];
  } catch {
    return [];
  }
};

const TripBuilder = ({ mode }) => {
  const isPackageMode = mode === "package";
  const { token } = useAuth();
  const { tripId: urlTripId } = useParams();
  const [searchParams] = useSearchParams();
  const draftKey = searchParams.get("d") || "default";
  const navigate = useNavigate();

  // Helper to format image URLs
  const formatImageUrl = useCallback((path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:")) return path;

    // Clean up the path (remove leading slashes)
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;

    // Construct base URL from API_URL (removing /api and any trailing slashes)
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:8000/api"
    ).replace(/\/$/, ""); // Remove trailing slash if any

    return `${apiBase}/storage/${cleanPath}`;
  }, []);

  const [activeTab, setActiveTab] = useState("Trip Info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  const [otherCosts, setOtherCosts] = useState([]);
  const [itinerary, setItinerary] = useState([]);

  const standardInclusions = Array.isArray(policies.defaultInclusions)
    ? policies.defaultInclusions.filter((i) => i.trim() !== "")
    : [];

  const standardExclusions = Array.isArray(policies.defaultExclusions)
    ? policies.defaultExclusions.filter((i) => i.trim() !== "")
    : [];

  const [accommodations, setAccommodations] = useState([]);
  const [transportation, setTransportation] = useState([]);
  const [availableDestinations, setAvailableDestinations] = useState([]);
  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [masterHotels, setMasterHotels] = useState([]);

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
  const normalizeAccommodation = useCallback((item = {}) => {
    const legacyCnbSelected =
      (item.extraBedCategory || item.extra_bed_category) === "cnb";
    const legacyAbove12Selected =
      (item.extraBedCategory || item.extra_bed_category) === "above_12";
    const cnbCount =
      item.cnbCount ??
      item.cnb_count ??
      (legacyCnbSelected ? item.beds || "0" : "0");
    const extraBeds5To12Count =
      item.extraBeds5To12Count ??
      item.extra_beds_5_to_12_count ??
      (!legacyCnbSelected && !legacyAbove12Selected ? item.beds || "0" : "0");
    const extraBedsAbove12Count =
      item.extraBedsAbove12Count ??
      item.extra_beds_above_12_count ??
      (legacyAbove12Selected ? item.beds || "0" : "0");

    return {
      ...item,
      cnbCount,
      extraBeds5To12Count,
      extraBedsAbove12Count,
      extraAdultCount: item.extraAdultCount ?? item.extra_adult_count ?? "0",
      cancelledAt: item.cancelledAt ?? item.cancelled_at ?? null,
      cancellationCharge: item.cancellationCharge ?? item.cancellation_charge ?? "",
      cancellationNote: item.cancellationNote ?? item.cancellation_note ?? "",
      alternateOptions: item.alternateOptions ?? item.alternate_options ?? [],
    };
  }, []);

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
    setPolicies,
    setTripInfo,
    setIncludeGST,
    setInclusions,
    setExclusions,
    setOtherCosts,
    setItinerary,
    setAccommodations,
    setTransportation,
    setHasDraft,
    setGstPercentage,
    setProfitMarginPercentage,
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
  const [editingHotelId, setEditingHotelId] = useState(null);
  const [editingTransportId, setEditingTransportId] = useState(null);

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
  });

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
      });
      setEditingHotelId(null);
      setIsHotelModalOpen(false);
    }
  };

  const handleAddTransport = () => {
    if (transportForm.route && transportForm.date) {
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
      });
      setEditingTransportId(null);
      setIsTransportModalOpen(false);
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
    });
    setEditingTransportId(transport.id);
    setIsTransportModalOpen(true);
  };

  const removeAccommodation = (id) => {
    setAccommodations(accommodations.filter((hotel) => hotel.id !== id));
  };

  const removeTransportation = (id) => {
    setTransportation(transportation.filter((item) => item.id !== id));
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

  const totalHotelCost = accommodations.reduce(
    (sum, item) => sum + calculateHotelCost(item),
    0,
  );
  const totalVehicleCost = transportation.reduce(
    (sum, item) => sum + calculateVehicleCost(item),
    0,
  );
  const totalOtherCost = otherCosts.reduce(
    (sum, item) => sum + parseFloat(item.price || 0),
    0,
  );

  const netCost = totalHotelCost + totalVehicleCost + totalOtherCost;
  const gstAmountValue = includeGST ? netCost * (gstPercentage / 100) : 0;
  const costWithGst = netCost + gstAmountValue;
  const calculatedTotalCost = costWithGst * (1 + profitMarginPercentage / 100);

  useEffect(() => {
    const nextCost = Math.max(0, Math.round(calculatedTotalCost)).toString();
    setTripInfo((prev) =>
      prev.cost === nextCost
        ? prev
        : {
            ...prev,
            cost: nextCost,
          },
    );
  }, [calculatedTotalCost]);

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
      };
    });

    const fullTripData = {
      ...tripInfo,
      include_gst: includeGST,
      gst_amount: includeGST ? Number(gstAmountValue.toFixed(2)) : 0,
      use_flight: tripInfo.useFlight,
      transport_details: (tripInfo.transportDetails || []).map((t) => ({
        ...t,
        departure_date_time: t.departureDateTime,
        arrival_date_time: t.arrivalDateTime,
      })),
      itineraries: formattedItineraries,
      accommodations: formattedAccommodations,
      transportations: formattedTransportations,
      other_costs: otherCosts.filter((c) => c.name && c.price > 0),
      inclusions,
      exclusions,
      ...(urlTripId ? {} : { status: "pending" }),
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
          navigate(`/trip-builder/${createdTrip.trip_id}`, { replace: true });
        }
      }
      setAutoState("saved");
      setLastSavedAt(Date.now());
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

  const handleSaveTrip = () => saveTrip();

  // ── Auto-save: debounced silent save on any change ─────────────────────
  const saveRef = useRef(saveTrip);
  saveRef.current = saveTrip;
  const savingRef = useRef(false);
  savingRef.current = saving || loading;
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!savingRef.current) saveRef.current?.({ silent: true });
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
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("There was an error generating your PDF. Please try again.");
    } finally {
      setExporting(false);
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
      <button
        onClick={handleExport}
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
            <Download className="w-3.5 h-3.5" /> Export
          </>
        )}
      </button>
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

  return (
    <>
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
                        calculatedTotalCost={calculatedTotalCost}
                        includeGST={includeGST}
                        setIncludeGST={setIncludeGST}
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
                      />
                    )}

                    {activeTab === "Pricing" && (
                      <PricingTab
                        totalHotelCost={totalHotelCost}
                        totalVehicleCost={totalVehicleCost}
                        otherCosts={otherCosts}
                        setOtherCosts={setOtherCosts}
                        gstPercentage={gstPercentage}
                        setGstPercentage={setGstPercentage}
                        profitMarginPercentage={profitMarginPercentage}
                        setProfitMarginPercentage={setProfitMarginPercentage}
                        calculatedTotalCost={calculatedTotalCost}
                      />
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
                      key={`${tripInfo.template}-${tripInfo.cost}-${includeGST ? 1 : 0}-${gstPercentage}-${profitMarginPercentage}-${accommodations.length}-${transportation.length}-${otherCosts.length}`}
                      tripInfo={tripInfo}
                      itinerary={itinerary}
                      accommodations={resolvedAccommodations}
                      transportation={transportation}
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
      </AssistantFrame>

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
      />
    </>
  );
};

export default TripBuilder;
