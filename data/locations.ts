export type ScreenLocation = {
  id: string;
  name: string;
  operator?: string;
  city: string;
  region: string; // Use an exact region name from data/lebanon-map.json.
  latitude: number;
  longitude: number;
  status: "planned" | "coming-soon" | "live";
  screenWidth?: number;
  screenHeight?: number;
  aspectRatio?: string;
  videoDuration: number;
  supportsImage: boolean;
  supportsVideo: boolean;
  bookingTypes: string[];
  availability?: string;
  baseDailyPrice?: number | null;
  baseWeeklyPrice?: number | null;
  specialEventPrices?: Record<string, number>;
  currency?: string;
};

// Add only verified business locations. An empty array is intentional.
export const locations: ScreenLocation[] = [];
