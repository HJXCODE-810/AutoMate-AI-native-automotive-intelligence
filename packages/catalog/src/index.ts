import seed from "../data/catalog-seed.json";
import { createRegistry, parseCatalog } from "./registry.ts";

export { parseCatalog, createRegistry, type Registry } from "./registry.ts";
export const catalog = parseCatalog(seed);
export const registry = createRegistry(seed);
