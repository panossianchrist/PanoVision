export type Rates = {
  daily?: number | null;
  weekly?: number | null;
  special?: Record<string, number>;
  currency?: string;
};
export type CampaignPackage = {
  id: string;
  name: string;
  screenIds: string[];
  discountPercent?: number;
};
export type PricingConfig = {
  currency: string;
  areas: Record<string, Rates>;
  packages: CampaignPackage[];
  multiLocationDiscount: { minimumLocations: number; percent: number } | null;
};

// Add only approved business rates. Empty configuration intentionally produces no estimate.
export const pricing: PricingConfig = {
  currency: "",
  areas: {},
  packages: [],
  multiLocationDiscount: null,
};
