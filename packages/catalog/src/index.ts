import seed from "../data/catalog-seed.json";
import { createRegistry } from "./registry.ts";

export { parseCatalog, createRegistry, type Registry } from "./registry.ts";
export const registry = createRegistry(seed);
