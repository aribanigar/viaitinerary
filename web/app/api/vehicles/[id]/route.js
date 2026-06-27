import { catalogItem, mapVehicle } from "@/lib/catalog";
import { catalogVehicle } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, PUT, DELETE } = catalogItem({
  model: "vehicle",
  mapBody: mapVehicle,
  serialize: catalogVehicle,
});
export { GET, PUT, DELETE };
