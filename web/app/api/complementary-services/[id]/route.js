import { catalogItem, mapComplementaryService } from "@/lib/catalog";
import { catalogComplementaryService } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, PUT, DELETE } = catalogItem({
  model: "complementaryService",
  mapBody: mapComplementaryService,
  serialize: catalogComplementaryService,
});
export { GET, PUT, DELETE };
