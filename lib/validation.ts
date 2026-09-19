export type CampaignValues = {
  company: string;
  contact: string;
  email: string;
  phone: string;
  campaign: string;
  creativeType: string;
  campaignType: string;
  locationPreference: string;
  city: string;
  region: string;
  notes: string;
  startDate: string;
  endDate: string;
  duration: string;
  customDuration: string;
  selectedLocation: string;
  selectedCities?: string[];
  selectedScreens?: string[];
  packageId?: string;
  occasionType?: string;
  preferredTime?: string;
};
export type FieldErrors = Partial<Record<keyof CampaignValues, string>>;
export const emptyCampaign: CampaignValues = {
  company: "",
  contact: "",
  email: "",
  phone: "",
  campaign: "",
  creativeType: "Image",
  campaignType: "Weekly",
  locationPreference: "Need recommendation",
  city: "",
  region: "",
  notes: "",
  startDate: "",
  endDate: "",
  duration: "5 minutes",
  customDuration: "",
  selectedLocation: "",
  selectedCities: [],
  selectedScreens: [],
  packageId: "",
  occasionType: "Custom",
  preferredTime: "",
};
export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function validateCampaignStep(
  step: number,
  values: CampaignValues,
  today = localDate(),
): FieldErrors {
  const errors: FieldErrors = {};
  if (step === 0) {
    if (!values.company.trim()) errors.company = "Enter your company name.";
    if (!values.contact.trim()) errors.contact = "Enter a contact person.";
    if (!isEmail(values.email)) errors.email = "Enter a valid email address.";
    if (
      values.phone.trim() &&
      !/^[+()\d\s.\-]{6,30}$/.test(values.phone.trim())
    )
      errors.phone = "Use a phone number, including a country code if needed.";
  }
  if (step === 1 && !values.campaign.trim())
    errors.campaign = "Give your campaign a name.";
  if (
    step === 2 &&
    values.locationPreference === "Area / region" &&
    !values.selectedCities?.length &&
    !values.city.trim() &&
    !values.region
  )
    errors.region = "Choose a region or enter a preferred city.";
  if (step === 3) {
    if (values.campaignType === "Special occasion") {
      if (!values.startDate)
        errors.startDate = "Choose a date for your occasion.";
      if (
        !values.preferredTime ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.preferredTime)
      )
        errors.preferredTime = "Choose a time for your occasion.";
      if (
        values.duration === "Custom" &&
        (!/^\d+$/.test(values.customDuration) ||
          Number(values.customDuration) < 1 ||
          Number(values.customDuration) > 1440)
      )
        errors.customDuration = "Enter a duration from 1 to 1440 minutes.";
    }
    if (values.startDate && values.startDate < today)
      errors.startDate = "Choose today or a future date.";
    if (values.endDate && values.endDate < today)
      errors.endDate = "Choose today or a future date.";
    if (values.startDate && values.endDate && values.endDate < values.startDate)
      errors.endDate = "End date must be on or after the start date.";
    if (
      values.campaignType === "Special occasion" &&
      values.duration === "Custom" &&
      !values.customDuration.trim()
    )
      errors.customDuration = "Enter your requested display duration.";
  }
  return errors;
}
export const maxFileSize = 50 * 1024 * 1024;
export function validateFile(
  file: { name: string; type: string; size: number },
  creativeType: string,
) {
  const types =
    creativeType === "Image"
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["video/mp4", "video/webm"];
  if (!types.includes(file.type))
    return creativeType === "Image"
      ? "Choose a JPEG, PNG or WebP image."
      : "Choose an MP4 or WebM video.";
  const limit = creativeType === "Image" ? 10 * 1024 * 1024 : maxFileSize;
  if (file.size > limit)
    return `Choose a file no larger than ${creativeType === "Image" ? 10 : 50} MB.`;
  if (file.size === 0) return "This file is empty. Choose another file.";
  return "";
}
