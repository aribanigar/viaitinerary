import { useEffect } from "react";
import { fetchBuilderInit } from "../../../api/trips";

export const DRAFT_KEY = "trip_builder_draft";

export const useTripBuilderData = ({
  token,
  urlTripId,
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
}) => {
  useEffect(() => {
    if (loading || urlTripId) return;

    const timer = setTimeout(() => {
      const draftData = {
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
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      } catch (e) {
        console.warn(
          "Failed to save draft to localStorage (possibly quota exceeded):",
          e,
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
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
    loading,
    urlTripId,
  ]);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      setLoading(true);

      try {
        const initData = await fetchBuilderInit(token, urlTripId);
        const configuredDefaultTripImage = formatImageUrl(
          initData.settings?.default_trip_image_url ||
            initData.settings?.default_trip_image_path ||
            initData.settings?.defaultTripImage,
        );
        setDefaultTripImage(configuredDefaultTripImage || "");

        if (initData.settings) {
          setAgencySettings({
            agencyName: initData.settings.agency_name,
            phone: initData.settings.contact_phone,
            website: initData.settings.website,
            companyAddress: initData.settings.company_address || "",
            email: initData.settings.contact_email,
            whatsapp: initData.settings.whatsapp,
            brandColor: initData.settings.brand_color,
            secondaryColor: initData.settings.secondary_color,
            fontFamily: initData.settings.font_family,
            logo: initData.settings.logo_url || initData.settings.logo_path,
            tagline:
              initData.settings.tagline ||
              "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES",
            greetingMessage: initData.settings.greeting_message,
            beneficiaryName: initData.settings.beneficiary_name,
            bankName: initData.settings.bank_name || initData.settings.bankName,
            accountNumber: initData.settings.account_number,
            ifscCode: initData.settings.ifsc_code,
            defaultTripImage: configuredDefaultTripImage || null,
          });
        }

        if (initData.destinations) {
          setAvailableDestinations(initData.destinations);
        }
        if (initData.vehicles) setAvailableVehicles(initData.vehicles);
        if (initData.hotels) setMasterHotels(initData.hotels);

        if (initData.policies) {
          setPolicies({
            termsConditions: initData.policies.terms_conditions || "",
            mustHaves: initData.policies.must_haves || "",
            rolesResponsibilities:
              initData.policies.roles_responsibilities || "",
            cancellationPolicy: initData.policies.cancellation_policy || "",
            additionalExpenses: initData.policies.additional_expenses || "",
            defaultInclusions: initData.policies.default_inclusions || [],
            defaultExclusions: initData.policies.default_exclusions || [],
          });
        }

        const savedTrip = initData.trip;

        if (savedTrip) {
          setTripInfo({
            tripId: savedTrip.trip_id || savedTrip.tripId,
            tripTitle: savedTrip.trip_title || savedTrip.tripTitle,
            destination: savedTrip.destination || "",
            destinationId:
              savedTrip.destination_id || savedTrip.destinationId || null,
            clientName: savedTrip.client_name || savedTrip.clientName,
            clientPhone: savedTrip.client_phone || savedTrip.clientPhone || "",
            clientEmail: savedTrip.client_email || savedTrip.clientEmail || "",
            locked: savedTrip.locked ?? false,
            adults: savedTrip.adults || 2,
            kidsUpto5: savedTrip.kids_cnb || 0,
            kids5to12: savedTrip.kids_5_to_12 || 0,
            startDate:
              savedTrip.start_date ||
              savedTrip.startDate ||
              new Date().toISOString().split("T")[0],
            duration: savedTrip.duration,
            cost: savedTrip.cost || "0",
            currency: savedTrip.currency,
            image:
              formatImageUrl(
                savedTrip.image_url || savedTrip.image_path || savedTrip.image,
              ) ||
              configuredDefaultTripImage ||
              "",
            status: savedTrip.status,
            template: savedTrip.template || "ModernTemplate",
            useFlight: savedTrip.use_flight ?? false,
            tagline:
              savedTrip.tagline ||
              initData.settings?.tagline ||
              "BOOK VERIFIED HOTELS, CABS, TOUR PACKAGES, ACTIVITIES & EXPERIENCES",
            transportDetails: (savedTrip.transport_details || []).map(
              (transport) => ({
                ...transport,
                departureDateTime: transport.departure_date_time
                  ? new Date(
                      new Date(transport.departure_date_time).getTime() -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : "",
                arrivalDateTime: transport.arrival_date_time
                  ? new Date(
                      new Date(transport.arrival_date_time).getTime() -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : "",
              }),
            ),
          });

          setIncludeGST(savedTrip.include_gst ?? true);
          setInclusions(savedTrip.inclusions || []);
          setExclusions(savedTrip.exclusions || []);

          if (savedTrip.other_costs) {
            setOtherCosts(
              (
                (typeof savedTrip.other_costs === "string"
                  ? JSON.parse(savedTrip.other_costs)
                  : savedTrip.other_costs) || []
              ).map((c, idx) => ({
                id: c.id || Date.now() + idx,
                name: c.name || "",
                price: c.price || 0,
              })),
            );
          } else {
            setOtherCosts([]);
          }

          const mappedItinerary = (
            savedTrip.itineraries ||
            savedTrip.itinerary ||
            []
          ).map((item) => ({
            id: item.id,
            day: item.day_number || item.day,
            title: item.title,
            location: item.location,
            destinationId:
              item.destination_id ||
              initData.destinations.find((d) => d.name === item.location)?.id ||
              null,
            description: item.description,
            activities:
              item.description && typeof item.description === "string"
                ? item.description.split("\n").filter((a) => a.trim() !== "")
                : [],
            photo: formatImageUrl(
              item.image_url || item.image_path || item.photo,
            ),
          }));
          setItinerary(mappedItinerary);

          const mappedAccommodations = (savedTrip.accommodations || []).map(
            (item) =>
              normalizeAccommodation({
                id: item.id,
                hotelId: item.hotel_id || item.hotelId,
                name: item.hotel?.name ?? item.name,
                city: item.hotel?.city ?? item.city,
                category: item.category,
                rooms: item.rooms || "1",
                mealPlan: item.meal_plan || item.mealPlan,
                roomType: item.room_type || item.roomType || "Deluxe",
                pricePerRoom: item.price_per_room || item.pricePerRoom || "",
                cnbCount: item.cnb_count || item.cnbCount || "0",
                extraBeds5To12Count:
                  item.extra_beds_5_to_12_count ||
                  item.extraBeds5To12Count ||
                  "0",
                extraBedsAbove12Count:
                  item.extra_beds_above_12_count ||
                  item.extraBedsAbove12Count ||
                  "0",
                bedPrices: item.bed_prices || item.bedPrices || [],
                checkIn: item.check_in || item.checkIn,
                checkOut: item.check_out || item.checkOut,
                photo: formatImageUrl(
                  item.image_url || item.image_path || item.photo,
                ),
              }),
          );
          setAccommodations(mappedAccommodations);

          const mappedTransportation = (
            savedTrip.transportations ||
            savedTrip.transportation ||
            []
          ).map((item) => ({
            id: item.id,
            vehicleId: item.vehicle_id || item.vehicleId,
            tripType: item.trip_type || item.tripType || "Transfer",
            destination: item.destination,
            route: item.route,
            date: item.date,
            vehicleType: item.vehicle_type || item.vehicleType,
            quantity: item.quantity || 1,
            remarks: item.remarks,
          }));
          setTransportation(mappedTransportation);
        } else if (urlTripId) {
          toast.error("You are not allowed to access this trip.");
          navigate("/trip-builder", { replace: true });
        } else if (!urlTripId) {
          const savedDraft = localStorage.getItem(DRAFT_KEY);
          if (savedDraft) {
            setHasDraft(true);
            try {
              const draft = JSON.parse(savedDraft);

              if (draft.tripInfo) {
                setTripInfo({
                  ...draft.tripInfo,
                  image:
                    draft.tripInfo.image || configuredDefaultTripImage || "",
                });
                setItinerary(draft.itinerary || []);
                setAccommodations(
                  (draft.accommodations || []).map(normalizeAccommodation),
                );
                setTransportation(draft.transportation || []);
                setInclusions(draft.inclusions || []);
                setExclusions(draft.exclusions || []);
                setOtherCosts(draft.otherCosts || []);
                setIncludeGST(draft.includeGST ?? true);
                setGstPercentage(draft.gstPercentage ?? 5);
                setProfitMarginPercentage(draft.profitMarginPercentage ?? 10);

                toast.info("Retrieved your unsaved trip details");
              }
            } catch (e) {
              console.error("Failed to parse draft:", e);
              resetToNewTrip();
            }
          } else {
            setHasDraft(false);
            resetToNewTrip();
          }
        }

        function resetToNewTrip() {
          setHasDraft(false);
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
            image: configuredDefaultTripImage || "",
            status: "Draft",
          });
          setItinerary([]);
          setAccommodations([]);
          setTransportation([]);
          setInclusions(
            Array.isArray(initData.policies?.default_inclusions)
              ? initData.policies.default_inclusions
                  .filter((i) => i.trim() !== "")
                  .map((c) => ({ content: c }))
              : [],
          );
          setExclusions(
            Array.isArray(initData.policies?.default_exclusions)
              ? initData.policies.default_exclusions
                  .filter((i) => i.trim() !== "")
                  .map((c) => ({ content: c }))
              : [],
          );
        }
      } catch (err) {
        console.error("Failed to load data:", err);

        if (urlTripId) {
          toast.error("Unable to load this trip.");
          navigate("/trip-builder", { replace: true });
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [
    urlTripId,
    navigate,
    token,
    formatImageUrl,
    normalizeAccommodation,
    setAccommodations,
    setAgencySettings,
    setAvailableDestinations,
    setAvailableVehicles,
    setDefaultTripImage,
    setExclusions,
    setGstPercentage,
    setHasDraft,
    setIncludeGST,
    setInclusions,
    setItinerary,
    setLoading,
    setMasterHotels,
    setOtherCosts,
    setPolicies,
    setProfitMarginPercentage,
    setTransportation,
    setTripInfo,
    toast,
  ]);
};
