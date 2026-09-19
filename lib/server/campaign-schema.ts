import { z } from "zod";
import { validateCampaignStep } from "../validation";
import { cities } from "../selection";
import { locations } from "../../data/locations";
import { pricing } from "../../config/pricing";
export const campaignSchema = z
  .object({
    company: z.string().trim().min(1).max(200),
    contact: z.string().trim().min(1).max(200),
    email: z.email().max(254),
    phone: z.string().max(30),
    campaign: z.string().trim().min(1).max(200),
    creativeType: z.enum(["Image", "8-second video"]),
    campaignType: z.enum(["Weekly", "Daily", "Special occasion", "Not sure"]),
    locationPreference: z.enum([
      "Individual location",
      "Area / region",
      "Package",
      "Need recommendation",
    ]),
    city: z.string().max(200),
    region: z.string().max(100),
    notes: z.string().max(3000),
    startDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
    endDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
    duration: z.enum(["5 minutes", "10 minutes", "Custom"]),
    customDuration: z.string().max(200),
    selectedLocation: z
      .string()
      .max(100)
      .refine((id) => !id || locations.some((screen) => screen.id === id)),
    selectedCities: z
      .array(
        z.string().refine((name) => cities.some((city) => city.name === name)),
      )
      .max(30)
      .default([]),
    selectedScreens: z
      .array(
        z
          .string()
          .max(100)
          .refine((id) => locations.some((screen) => screen.id === id)),
      )
      .max(100)
      .default([]),
    packageId: z
      .string()
      .max(100)
      .refine((id) => !id || pricing.packages.some((item) => item.id === id))
      .default(""),
    occasionType: z
      .enum([
        "Birthday",
        "Proposal",
        "Congratulations",
        "Opening",
        "Launch",
        "Event",
        "Celebration",
        "Custom",
      ])
      .default("Custom"),
    preferredTime: z
      .string()
      .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/)
      .default(""),
  })
  .strict()
  .superRefine((values, ctx) => {
    if (
      new Set(values.selectedCities).size !== values.selectedCities.length ||
      new Set(values.selectedScreens).size !== values.selectedScreens.length ||
      locations.some(
        (screen) =>
          values.selectedScreens.includes(screen.id) &&
          values.selectedCities.includes(screen.city),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid or overlapping selection",
        path: ["selectedCities"],
      });
    for (let step = 0; step < 4; step++) {
      for (const [key, message] of Object.entries(
        validateCampaignStep(step, values),
      ))
        ctx.addIssue({ code: "custom", message, path: [key] });
    }
    for (const key of ["startDate", "endDate"] as const) {
      if (!values[key]) continue;
      const date = new Date(values[key]);
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== values[key]
      )
        ctx.addIssue({ code: "custom", message: "Invalid date", path: [key] });
    }
  });
export const idempotencySchema = z.uuid();
