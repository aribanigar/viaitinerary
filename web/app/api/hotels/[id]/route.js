import { catalogItem, mapHotel } from "@/lib/catalog";
import { catalogHotel } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, PUT, DELETE } = catalogItem({
  model: "hotel",
  mapBody: mapHotel,
  serialize: catalogHotel,
});
export { GET, PUT, DELETE };
