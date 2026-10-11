import { interior } from "./interior";
import { hr } from "./hr";
export type { Field, Resource } from "./types";
export function resourcesFor(
  kind: "institution" | "business",
  sector: "interior-design" | "hr",
) {
  return sector === "hr" ? hr : kind === "business" ? interior : [];
}
export function draftPrice(
  kind: "institution" | "business",
  sector: "interior-design" | "hr",
) {
  return kind === "institution" ? 399000 : sector === "hr" ? 499000 : 249000;
}
