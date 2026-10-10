import type { CourierStats } from "@/lib/bdcourier";

// The couriers BD Courier reports on, with the logo URLs it serves. Used to
// render the breakdown before any number has been checked, so the page shows
// its real shape at rest instead of an empty placeholder.
export const IDLE_COURIERS: (CourierStats & { key: string })[] = [
  ["pathao", "Pathao", "pathao-logo.png"],
  ["steadfast", "SteadFast", "steadfast-logo.png"],
  ["parceldex", "ParcelDex", "parceldex-logo.png"],
  ["courrierfast", "CourrierFast", "courierfast-logo.png"],
  ["redx", "Redx", "redx-logo.png"],
  ["paperfly", "PaperFly", "paperfly-logo.png"],
  ["carrybee", "CarryBee", "carrybee-logo.webp"],
].map(([key, name, file]) => ({
  key,
  name,
  logo: `https://api.bdcourier.com/c-logo/${file}`,
  total_parcel: 0,
  success_parcel: 0,
  cancelled_parcel: 0,
  success_ratio: 0,
}));

export const EMPTY_SUMMARY = {
  total_parcel: 0,
  success_parcel: 0,
  cancelled_parcel: 0,
  success_ratio: 0,
};
