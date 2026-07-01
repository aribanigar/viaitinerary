import { catalogCollection, mapDestination } from "@/lib/catalog";
import { catalogDestination } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, POST } = catalogCollection({
  model: "destination",
  mapBody: mapDestination,
  serialize: catalogDestination,
  limitKind: "destination",
});
export { GET, POST };
