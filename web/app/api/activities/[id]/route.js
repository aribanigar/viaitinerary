import { catalogItem, mapActivity } from "@/lib/catalog";
import { catalogActivity } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, PUT, DELETE } = catalogItem({
  model: "activity",
  mapBody: mapActivity,
  serialize: catalogActivity,
  include: { destination: { select: { id: true, name: true } } },
});
export { GET, PUT, DELETE };
