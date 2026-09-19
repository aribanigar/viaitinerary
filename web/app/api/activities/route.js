import { catalogCollection, mapActivity } from "@/lib/catalog";
import { catalogActivity } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, POST } = catalogCollection({
  model: "activity",
  mapBody: mapActivity,
  serialize: catalogActivity,
  include: { destination: { select: { id: true, name: true } } },
  extraWhere: (searchParams) => {
    const destinationId = searchParams.get("destination_id");
    return destinationId ? { destinationId: parseInt(destinationId, 10) } : {};
  },
});
export { GET, POST };
