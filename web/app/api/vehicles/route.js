import { catalogCollection, mapVehicle } from "@/lib/catalog";
import { catalogVehicle } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, POST } = catalogCollection({
  model: "vehicle",
  mapBody: mapVehicle,
  serialize: catalogVehicle,
});
export { GET, POST };
