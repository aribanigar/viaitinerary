import { useEffect } from "react";
import { fetchBuilderInit } from "../../../api/trips";
import { mapAgencySettings, mapPolicies, mapSavedTrip } from "../../../utils/tripView";

export const DRAFT_KEY = "trip_builder_draft";

export const useTripBuilderData = ({
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
}) => {
  const draftStorageKey = `${DRAFT_KEY}:${draftKey || "default"}`;

  useEffect(() => {
    if (loading || urlTripId) return;

    const timer = setTimeout(() => {
      const draftData = {
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
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(draftData));
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
    tripActivities,
    inclusions,
    exclusions,
    otherCosts,
    includeGST,
    gstPercentage,
    profitMarginPercentage,
    loading,
    urlTripId,
    draftStorageKey,
  ]);

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      setLoading(true);
      // Re-arm the auto-cost guard for whichever trip we're about to load —
      // its real gstPercentage/profitMarginPercentage are about to be
      // restored below, and none of that should count as the agent editing
      // pricing themselves.
      setPricingTouched(false);

      try {
        const initData = await fetchBuilderInit(token, urlTripId);
        const configuredDefaultTripImage = formatImageUrl(
          initData.settings?.default_trip_image_url ||
            initData.settings?.default_trip_image_path ||
            initData.settings?.defaultTripImage,
        );
        setDefaultTripImage(configuredDefaultTripImage || "");

        if (initData.settings) {
          setAgencySettings(mapAgencySettings(initData.settings, configuredDefaultTripImage));
        }

        // Seed GST%/margin% from the agency's own settings — Trip only ever
        // stores the resulting absolute gstAmount/cost, never these
        // percentages, so without this every trip (new or existing) starts
        // the Pricing tab at 0%/0% until someone types real values in,
        // silently recalculating (and overwriting) cost the moment it loads.
        if (initData.settings) {
          if (initData.settings.gst_percentage != null) {
            setGstPercentage(Number(initData.settings.gst_percentage));
          }
          if (initData.settings.profit_percentage != null) {
            setProfitMarginPercentage(Number(initData.settings.profit_percentage));
          }
          if (initData.settings.include_gst != null) {
            setIncludeGST(!!initData.settings.include_gst);
          }
        }

        if (initData.destinations) {
          setAvailableDestinations(initData.destinations);
        }
        // Parts of the catalog the server couldn't load (it loads each on its
        // own) — say which, with the server's reason, instead of failing quietly.
        if (Array.isArray(initData.load_errors) && initData.load_errors.length) {
          const what = initData.load_errors.map((e) => e.part).join(", ");
          console.error("Trip Builder: couldn't load", initData.load_errors);
          toast.error(`Couldn't load ${what}: ${initData.load_errors[0].message}`, { autoClose: false });
        }
        if (initData.vehicles) setAvailableVehicles(initData.vehicles);
        if (initData.hotels) setMasterHotels(initData.hotels);
        if (initData.activities) setAvailableActivities(initData.activities);

        if (initData.policies) {
          setPolicies(mapPolicies(initData.policies));
        }

        const savedTrip = initData.trip;

        if (savedTrip) {
          const mapped = mapSavedTrip(initData, {
            formatImageUrl,
            configuredDefaultTripImage,
          });
          setTripInfo(mapped.tripInfo);
          setIncludeGST(mapped.includeGST);
          setInclusions(mapped.inclusions);
          setExclusions(mapped.exclusions);
          setOtherCosts(mapped.otherCosts);
          setItinerary(mapped.itinerary);
          setAccommodations(mapped.accommodations);
          setTransportation(mapped.transportation);
          setTripActivities(mapped.tripActivities);
          // Restore this trip's own GST%/margin% (agency defaults for trips
          // saved before those columns existed) — see pricingTouched.
          setGstPercentage(mapped.gstPercentage);
          setProfitMarginPercentage(mapped.profitMarginPercentage);
        } else if (urlTripId) {
          toast.error("You are not allowed to access this trip.");
          navigate("/trip-builder", { replace: true });
        } else if (!urlTripId) {
          const savedDraft = localStorage.getItem(draftStorageKey);
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
                setTripActivities(draft.tripActivities || []);
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
            currency: initData.settings?.currency || "INR (₹)",
            image: configuredDefaultTripImage || "",
            status: "Draft",
          });
          setItinerary([]);
          setAccommodations([]);
          setTransportation([]);
          setTripActivities([]);
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
        // Without this the builder opens with no destinations, hotels or
        // cabs to pick from and nothing says why.
        if (!urlTripId) toast.error("Couldn't load your destinations, hotels and cabs. Please refresh the page.");

        if (urlTripId) {
          toast.error("Unable to load this trip.");
          navigate("/trip-builder", { replace: true });
        }
      } finally {
        setLoadedTabId?.(urlTripId || `draft:${draftKey}`);
        setLoading(false);
      }
    }

    loadData();
  }, [
    urlTripId,
    draftKey,
    draftStorageKey,
    setLoadedTabId,
    navigate,
    token,
    formatImageUrl,
    normalizeAccommodation,
    setAccommodations,
    setAgencySettings,
    setAvailableActivities,
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
    setTripActivities,
    setTripInfo,
    toast,
  ]);
};
