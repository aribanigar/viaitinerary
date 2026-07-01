import { catalogCollection, mapHotel } from "@/lib/catalog";
import { catalogHotel } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, POST } = catalogCollection({
  model: "hotel",
  mapBody: mapHotel,
  serialize: catalogHotel,
  limitKind: "hotel",
});
export { GET, POST };
