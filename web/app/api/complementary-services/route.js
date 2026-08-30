import { catalogCollection, mapComplementaryService } from "@/lib/catalog";
import { catalogComplementaryService } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const { GET, POST } = catalogCollection({
  model: "complementaryService",
  mapBody: mapComplementaryService,
  serialize: catalogComplementaryService,
});
export { GET, POST };
