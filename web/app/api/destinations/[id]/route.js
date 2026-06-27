import { catalogItem, mapDestination } from "@/lib/catalog";
import { catalogDestination } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, PUT, DELETE } = catalogItem({
  model: "destination",
  mapBody: mapDestination,
  serialize: catalogDestination,
});
export { GET, PUT, DELETE };
