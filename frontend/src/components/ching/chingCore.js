// Ching's non-UI logic, loaded on demand (dynamic import from ChingWidget) so
// the parser/builder never weigh on the first paint of any dashboard page.
import { fetchBuilderInit } from "../../api/trips";
import {
  parseChingCommand,
  validateChingCommand,
} from "../../utils/ching/parseCommand";
import { createChingTrip } from "../../utils/ching/buildTrip";

export { validateChingCommand, createChingTrip };

// /api/builder/init is cached for the rest of the page session (per token);
// a failed load is forgotten so the next request retries.
let initCache = null;

export function getInit(token) {
  if (initCache && initCache.token === token) return initCache.promise;
  const promise = fetchBuilderInit(token).catch((err) => {
    if (initCache?.promise === promise) initCache = null;
    throw err;
  });
  initCache = { token, promise };
  return promise;
}

export const catalogOf = (init) => ({
  hotels: init?.hotels || [],
  destinations: init?.destinations || [],
  vehicles: init?.vehicles || [],
});

export async function interpret(text, token) {
  const init = await getInit(token);
  const command = parseChingCommand(text, catalogOf(init));
  return { init, command };
}
