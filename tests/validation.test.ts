import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyCampaign,
  validateCampaignStep,
  validateFile,
  maxFileSize,
} from "../lib/validation.ts";
test("company step rejects whitespace and invalid email", () => {
  const errors = validateCampaignStep(0, {
    ...emptyCampaign,
    company: "   ",
    contact: "Chris",
    email: "not-an-email",
  });
  assert.equal(Object.keys(errors).length, 2);
  assert.ok(errors.company);
  assert.ok(errors.email);
});
test("dates reject past dates and reversed intervals", () => {
  assert.ok(
    validateCampaignStep(
      3,
      { ...emptyCampaign, startDate: "2026-09-10" },
      "2026-09-15",
    ).startDate,
  );
  assert.ok(
    validateCampaignStep(
      3,
      { ...emptyCampaign, startDate: "2026-10-10", endDate: "2026-10-09" },
      "2026-09-15",
    ).endDate,
  );
  assert.deepEqual(
    validateCampaignStep(
      3,
      { ...emptyCampaign, startDate: "2026-10-10", endDate: "2026-10-10" },
      "2026-09-15",
    ),
    {},
  );
});
test("custom duration required only for a special occasion", () => {
  assert.ok(
    validateCampaignStep(3, {
      ...emptyCampaign,
      campaignType: "Special occasion",
      duration: "Custom",
    }).customDuration,
  );
  assert.deepEqual(
    validateCampaignStep(3, {
      ...emptyCampaign,
      campaignType: "Weekly",
      duration: "Custom",
    }),
    {},
  );
});
test("region booking needs either city or region", () => {
  assert.ok(
    validateCampaignStep(2, {
      ...emptyCampaign,
      locationPreference: "Area / region",
    }).region,
  );
  assert.deepEqual(
    validateCampaignStep(2, {
      ...emptyCampaign,
      locationPreference: "Area / region",
      city: "Beirut",
    }),
    {},
  );
});
test("creative file validation checks type, empty file and size", () => {
  assert.ok(
    validateFile(
      { name: "x.exe", type: "application/octet-stream", size: 100 },
      "Image",
    ),
  );
  assert.ok(
    validateFile({ name: "x.png", type: "image/png", size: 0 }, "Image"),
  );
  assert.ok(
    validateFile(
      { name: "x.png", type: "image/png", size: maxFileSize + 1 },
      "Image",
    ),
  );
  assert.equal(
    validateFile(
      { name: "x.mp4", type: "video/mp4", size: 1000 },
      "8-second video",
    ),
    "",
  );
});
