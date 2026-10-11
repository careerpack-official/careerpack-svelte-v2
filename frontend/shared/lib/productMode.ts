// The HR clone changes this default only; membership remains a server-side rule.
export const IS_HR_PILOT =
  (process.env.NEXT_PUBLIC_PRODUCT_MODE ?? "careerpack") === "hr";
export const PERSONAL_APP_ORIGIN = IS_HR_PILOT ? "https://careerpack.org" : "";
