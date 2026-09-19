export type CustomerProfile = {
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  role: string;
  language: "en" | "fr" | "ar";
};
export type CampaignEvidence = {
  id: string;
  screenName: string;
  city: string;
  playedAt: number;
  playCount: number | null;
  creativeName: string;
  source: "manual" | "player";
  notes: string;
  verifiedAt: number;
};
export type CustomerCampaign = {
  id: string;
  name: string;
  details: Record<string, unknown>;
  businessStatus: string;
  creative: {
    id: string;
    filename: string;
    status: string;
    message: string;
    canContinue: boolean;
    mediaType: string;
    previewAvailable: boolean;
  } | null;
  createdAt: number;
  updatedAt: number;
  quote: {
    amount: number;
    currency: string;
    issuedAt: number;
    notes: string;
  } | null;
  paymentStatus: "pending" | "confirmed";
  scheduleStatus: "pending" | "confirmed";
  evidence: CampaignEvidence[];
};
