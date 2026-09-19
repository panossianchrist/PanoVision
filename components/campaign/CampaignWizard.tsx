"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Download,
  FileImage,
  FileVideo,
  UploadCloud,
  X,
  Pencil,
  LockKeyhole,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import {
  emptyCampaign,
  localDate,
  validateCampaignStep,
  validateFile,
  type CampaignValues,
  type FieldErrors,
} from "@/lib/validation";
import { company } from "@/lib/company";
import { downloadRequest } from "@/lib/download";
import { locations } from "@/data/locations";
import map from "@/data/lebanon-map.json";
import { CreativeModeration } from "@/components/moderation/CreativeModeration";
import type { PublicAsset } from "@/lib/moderation/types";
import { useTranslations } from "next-intl";
import {
  cleanSelection,
  cities,
  toggleCity,
  toggleScreen,
  type LocationSelection,
} from "@/lib/selection";
import { pricing } from "@/config/pricing";
import { campaignScreenIds } from "@/lib/pricing";
import { CampaignEstimate } from "./CampaignEstimate";
import { CreativePreview } from "./CreativePreview";
import { AccountForm } from "@/components/account/AccountForm";
import type { CustomerProfile } from "@/lib/account-types";

const steps = [
  "Company",
  "Campaign",
  "Location",
  "Dates",
  "Creative",
  "Review",
];
const optionKeys: Record<string, string> = {
  Image: "Image",
  "8-second video": "Video",
  Weekly: "Weekly",
  Daily: "Daily",
  "Special occasion": "Special",
  "Not sure": "Unsure",
  "Individual location": "Individual",
  "Area / region": "Area",
  Package: "Package",
  "Need recommendation": "Recommendation",
  "5 minutes": "Five",
  "10 minutes": "Ten",
  Custom: "Custom",
};

function Field({
  label,
  name,
  error,
  required = false,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={name}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {children}
      {error && (
        <span id={`${name}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
function Choices({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("campaign.options");
  return (
    <fieldset className="choice-fieldset">
      <legend>{legend}</legend>
      <div className="choice-group">
        {options.map((option) => (
          <label key={option} className={value === option ? "selected" : ""}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span>{t(optionKeys[option])}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CampaignWizard({
  initialRegion = "",
  initialLocation = "",
  initialSelection = { cities: [], screens: [] },
  initialOccasion = "",
  initialMinutes = "",
  initialSpecial = false,
  initialDraft = "",
  initialProfile = null,
}: {
  initialRegion?: string;
  initialLocation?: string;
  initialSelection?: LocationSelection;
  initialOccasion?: string;
  initialMinutes?: string;
  initialSpecial?: boolean;
  initialDraft?: string;
  initialProfile?: CustomerProfile | null;
}) {
  const t = useTranslations("campaign"),
    common = useTranslations("common"),
    mt = useTranslations("map"),
    special = useTranslations("special"),
    accountText = useTranslations("account");
  const [profile, setProfile] = useState(initialProfile),
    [showAccount, setShowAccount] = useState(false);
  const station = locations.find((location) => location.id === initialLocation);
  const initial = cleanSelection(initialSelection);
  const [values, setValues] = useState<CampaignValues>({
    ...emptyCampaign,
    company: initialProfile?.company || "",
    contact: initialProfile?.name || "",
    email: initialProfile?.email || "",
    phone: initialProfile?.phone || "",
    selectedCities: initial.cities,
    selectedScreens: initial.screens,
    campaignType: initialSpecial ? "Special occasion" : "Weekly",
    occasionType: [
      "Birthday",
      "Proposal",
      "Congratulations",
      "Opening",
      "Launch",
      "Event",
      "Celebration",
      "Custom",
    ].includes(initialOccasion)
      ? initialOccasion
      : "Custom",
    duration:
      initialMinutes === "10"
        ? "10 minutes"
        : initialMinutes === "custom"
          ? "Custom"
          : "5 minutes",
    region:
      station?.region ||
      (map.regions.some((r) => r.name === initialRegion) ? initialRegion : ""),
    city: station?.city || "",
    selectedLocation: station?.id || "",
    locationPreference:
      station || initial.screens.length
        ? "Individual location"
        : initialRegion || initial.cities.length
          ? "Area / region"
          : "Need recommendation",
  });
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [received, setReceived] = useState(false);
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const validationRun = useRef(0);
  const initialPlan = JSON.stringify({
    initialRegion,
    initialLocation,
    initialSelection,
    initialOccasion,
    initialMinutes,
    initialSpecial,
  });
  const fieldError = (key: keyof CampaignValues) =>
    !errors[key]
      ? undefined
      : t(
          key === "email"
            ? "errorEmail"
            : key === "phone"
              ? "errorPhone"
              : key === "startDate" || key === "endDate"
                ? "errorDate"
                : "errorRequired",
        );

  useEffect(() => {
    const hasNewPlan =
      initialSelection.cities.length > 0 ||
      initialSelection.screens.length > 0 ||
      initialSpecial;
    const matchingPlan =
      sessionStorage.getItem("panoCampaignPlan") === initialPlan;
    const id =
      initialDraft ||
      (!hasNewPlan || matchingPlan
        ? sessionStorage.getItem("panoCampaignId")
        : "");
    if (!id) return;
    const controller = new AbortController();
    async function restore() {
      try {
        const draftResponse = await fetch(
          `/api/campaigns/draft?id=${encodeURIComponent(id!)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!draftResponse.ok) return;
        const draft = await draftResponse.json();
        if (
          draft.businessStatus !== "draft" &&
          draft.businessStatus !== "paused"
        )
          return;
        if (!draft.currentAssetId) {
          if (!controller.signal.aborted) {
            setValues({ ...emptyCampaign, ...draft.details });
            setCampaignId(id!);
          }
          return;
        }
        const statusResponse = await fetch(
          `/api/creative/${encodeURIComponent(draft.currentAssetId)}/status`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!statusResponse.ok) return;
        const status = await statusResponse.json();
        if (
          !controller.signal.aborted &&
          draft.currentAssetId === status.asset.id
        ) {
          setValues({ ...emptyCampaign, ...draft.details });
          setCampaignId(id!);
          setAsset(status.asset);
          setStep(4);
          setFurthest(4);
        }
      } catch {
        /* A previous session never bypasses a fresh server check. */
      }
    }
    void restore();
    return () => controller.abort();
  }, [
    initialDraft,
    initialSelection.cities.length,
    initialSelection.screens.length,
    initialSpecial,
    initialPlan,
  ]);

  const update = (
    key: Exclude<keyof CampaignValues, "selectedCities" | "selectedScreens">,
    value: string,
  ) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "locationPreference" && value !== "Package"
        ? { packageId: "" }
        : {}),
    }));
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setPrepared(false);
    if (key === "creativeType") {
      validationRun.current++;
      setFile(null);
      setAsset(null);
      setFileError("");
      setFileBusy(false);
      if (upload.current) upload.current.value = "";
    }
  };
  const input = (
    name: Exclude<keyof CampaignValues, "selectedCities" | "selectedScreens">,
    type = "text",
    required = false,
  ) => (
    <input
      id={name}
      name={name}
      type={type}
      required={required}
      value={values[name] || ""}
      onChange={(event) => update(name, event.target.value)}
      aria-invalid={!!errors[name]}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
      autoComplete={
        (
          {
            company: "organization",
            contact: "name",
            email: "email",
            phone: "tel",
          } as Record<string, string>
        )[name] || "off"
      }
      maxLength={name === "email" ? 254 : 200}
      {...(type === "date"
        ? {
            min:
              name === "endDate" && values.startDate
                ? values.startDate
                : localDate(),
          }
        : {})}
    />
  );
  const go = (next: number) => {
    setErrors({});
    setStep(next);
    setPrepared(false);
    setSubmitError("");
    requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  };
  const next = () => {
    const found = validateCampaignStep(step, values);
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() =>
        document.getElementById(Object.keys(found)[0])?.focus(),
      );
      return;
    }
    if (step === 4 && (fileError || fileBusy)) return;
    if (step === 4 && !asset?.canContinue) {
      setSubmitError(t("approvalRequired"));
      return;
    }
    setFurthest(Math.max(furthest, step + 1));
    go(step + 1);
  };
  async function chooseFile(candidate: File | undefined) {
    if (!candidate) return;
    const run = ++validationRun.current;
    setFile(null);
    setAsset(null);
    setPrepared(false);
    const invalid = validateFile(candidate, values.creativeType);
    setFileError(invalid ? t("errorFile") : "");
    if (invalid) return;
    setFileBusy(true);
    const url = URL.createObjectURL(candidate);
    try {
      if (values.creativeType === "8-second video") {
        const duration = await new Promise<number>((resolve, reject) => {
          const video = document.createElement("video");
          const timer = window.setTimeout(() => {
            video.removeAttribute("src");
            video.load();
            reject(new Error(t("errorVideo")));
          }, 10000);
          const finish = () => {
            window.clearTimeout(timer);
            video.removeAttribute("src");
            video.load();
          };
          video.onloadedmetadata = () => {
            const seconds = video.duration;
            finish();
            resolve(seconds);
          };
          video.onerror = () => {
            finish();
            reject(new Error(t("errorVideo")));
          };
          video.preload = "metadata";
          video.src = url;
        });
        if (!Number.isFinite(duration) || Math.abs(duration - 8) > 0.25)
          throw new Error(t("errorVideo"));
      } else {
        const bitmap = await createImageBitmap(candidate);
        bitmap.close();
      }
      if (validationRun.current === run) setFile(candidate);
    } catch (error) {
      if (validationRun.current === run)
        setFileError(error instanceof Error ? error.message : t("errorFile"));
    } finally {
      URL.revokeObjectURL(url);
      if (validationRun.current === run) setFileBusy(false);
    }
  }
  const request = () => ({
    status: received ? "received" : "draft",
    preparedAt: new Date().toISOString(),
    campaignId,
    ...values,
    duration:
      values.campaignType === "Special occasion"
        ? values.duration === "Custom"
          ? values.customDuration
          : values.duration
        : undefined,
    creative: asset
      ? {
          id: asset.id,
          name: asset.filename,
          status: asset.status,
          storage: "Private PanoVision storage",
        }
      : null,
  });
  const selection = {
    cities: values.selectedCities || [],
    screens: values.selectedScreens || [],
  };
  const setSelection = (next: LocationSelection) =>
    setValues((previous) => ({
      ...previous,
      selectedCities: next.cities,
      selectedScreens: next.screens,
      packageId: "",
      selectedLocation: next.screens[0] || "",
      locationPreference: next.screens.length
        ? "Individual location"
        : "Area / region",
    }));
  const previewScreenIds = campaignScreenIds({
    ...selection,
    packageId: values.packageId,
  });
  const selectedScreens = locations.filter((item) =>
    previewScreenIds.includes(item.id),
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 5) {
      next();
      return;
    }
    for (let index = 0; index < 5; index++) {
      const found = validateCampaignStep(index, values);
      if (Object.keys(found).length) {
        go(index);
        setErrors(found);
        return;
      }
    }
    if (fileError || fileBusy || !asset?.canContinue) {
      go(4);
      return;
    }
    if (company.submissionMode === "demo") {
      setPrepared(true);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/campaign-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          assetId: asset.id,
          details: values,
        }),
      });
      await response.json();
      if (!response.ok) throw new Error(common("error"));
      setReceived(true);
      setPrepared(true);
      sessionStorage.removeItem("panoCampaignId");
      sessionStorage.removeItem("panoAssetId");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : common("error"));
    } finally {
      setSubmitting(false);
    }
  }
  const summary = [
    {
      name: t("steps.Company"),
      step: 0,
      lines: [values.company, values.contact, values.email, values.phone],
    },
    {
      name: t("steps.Campaign"),
      step: 1,
      lines: [
        values.campaign,
        t(`options.${optionKeys[values.creativeType]}`),
        t(`options.${optionKeys[values.campaignType]}`),
      ],
    },
    {
      name: t("fields.locationPreference"),
      step: 2,
      lines: [
        t(`options.${optionKeys[values.locationPreference]}`),
        ...selection.cities.map((city) => mt(`cityNames.${city}`)),
        ...selectedScreens.map((screen) => screen.name),
        station?.name || "",
        values.city,
        values.region,
        values.notes,
      ],
    },
    {
      name: accountText("dates"),
      step: 3,
      lines: [
        values.startDate || t("startPending"),
        values.endDate || t("endPending"),
        values.campaignType === "Special occasion"
          ? `${t("fields.duration")}: ${values.duration === "Custom" ? values.customDuration : t(`options.${optionKeys[values.duration]}`)} / ${values.preferredTime || ""}`
          : "",
      ],
    },
    {
      name: t("steps.Creative"),
      step: 4,
      lines: [
        file ? file.name : asset?.filename || t("noFile"),
        asset?.canContinue
          ? accountText("statuses.approved")
          : t("checkRequired"),
      ],
    },
  ];
  return (
    <div className="wizard-layout">
      <aside className="wizard-sidebar">
        <span className="micro muted">{t("request")}</span>
        <ol className="wizard-progress">
          {steps.map((label, index) => (
            <li
              key={label}
              className={`${index === step ? "active" : ""} ${index < step ? "complete" : ""}`}
            >
              <button
                type="button"
                disabled={index > furthest || submitting || received}
                aria-current={index === step ? "step" : undefined}
                onClick={() => {
                  if (index <= step) go(index);
                  else next();
                }}
              >
                <span>
                  {index < step ? <Check size={14} /> : `0${index + 1}`}
                </span>
                {t(`steps.${label}`)}
              </button>
            </li>
          ))}
        </ol>
        <div className="wizard-note">
          <LockKeyhole size={18} />
          <p>{t("noPayment")}</p>
          <span>{t("confirmation")}</span>
        </div>
        <CampaignEstimate values={values} />
      </aside>
      <div className="wizard-main">
        <div className="campaign-account">
          {profile ? (
            <span className="small">
              {accountText("signedIn", { name: profile.name })}
            </span>
          ) : (
            <>
              <p>{accountText("gate")}</p>
              <button
                className="text-link"
                type="button"
                onClick={() => setShowAccount((value) => !value)}
              >
                {showAccount ? common("close") : common("login")}
                <ArrowUpRight size={16} />
              </button>
            </>
          )}
          {!profile && showAccount && (
            <AccountForm
              onAuthenticated={(user) => {
                setProfile(user);
                setShowAccount(false);
                setCampaignId("");
                setAsset(null);
                setValues((previous) => ({
                  ...previous,
                  company: previous.company || user.company,
                  contact: previous.contact || user.name,
                  email: previous.email || user.email,
                  phone: previous.phone || user.phone,
                }));
              }}
            />
          )}
        </div>
        {company.submissionMode === "demo" && (
          <div className="demo-banner">
            <p>{t("notSent")}</p>
          </div>
        )}
        <div className="wizard-topline">
          <span className="micro blue">{t("step", { step: step + 1 })}</span>
          <span className="micro muted">{t(`steps.${steps[step]}`)}</span>
        </div>
        <div className="wizard-track">
          <span style={{ width: `${((step + 1) / 6) * 100}%` }} />
        </div>
        <form onSubmit={submit} noValidate>
          <h2 ref={heading} tabIndex={-1}>
            {t(`titles.${steps[step]}`)}
          </h2>
          <p className="wizard-description">
            {t(`descriptions.${steps[step]}`)}
          </p>
          {step === 0 && (
            <div className="field-grid">
              <Field
                label={t("fields.company")}
                name="company"
                required
                error={fieldError("company")}
              >
                {input("company", "text", true)}
              </Field>
              <Field
                label={t("fields.contact")}
                name="contact"
                required
                error={fieldError("contact")}
              >
                {input("contact", "text", true)}
              </Field>
              <Field
                label={t("fields.email")}
                name="email"
                required
                error={fieldError("email")}
              >
                {input("email", "email", true)}
              </Field>
              <Field
                label={t("fields.phone")}
                name="phone"
                error={fieldError("phone")}
              >
                {input("phone", "tel")}
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="form-stack">
              <Field
                label={t("fields.campaign")}
                name="campaign"
                required
                error={fieldError("campaign")}
              >
                {input("campaign", "text", true)}
              </Field>
              <Choices
                legend={t("fields.creativeType")}
                name="creativeType"
                options={["Image", "8-second video"]}
                value={values.creativeType}
                onChange={(value) => update("creativeType", value)}
              />
              <Choices
                legend={t("fields.campaignType")}
                name="campaignType"
                options={["Weekly", "Daily", "Special occasion", "Not sure"]}
                value={values.campaignType}
                onChange={(value) => update("campaignType", value)}
              />
            </div>
          )}
          {step === 2 && (
            <div className="form-stack">
              <div className="city-options" aria-label={mt("pick")}>
                {cities.map((city) => (
                  <button
                    type="button"
                    key={city.name}
                    aria-pressed={selection.cities.includes(city.name)}
                    onClick={() =>
                      setSelection(toggleCity(selection, city.name))
                    }
                  >
                    <span className="city-checkbox">
                      {selection.cities.includes(city.name) && (
                        <Check size={12} />
                      )}
                    </span>
                    {mt(`cityNames.${city.name}`)}
                  </button>
                ))}
              </div>
              <p className="small" aria-live="polite">
                {mt("count", { count: selection.cities.length })}
              </p>
              {!!locations.length && (
                <fieldset className="screen-options">
                  <legend>{mt("screens")}</legend>
                  {locations.map((screen) => (
                    <button
                      type="button"
                      key={screen.id}
                      aria-pressed={selection.screens.includes(screen.id)}
                      onClick={() =>
                        setSelection(toggleScreen(selection, screen.id))
                      }
                    >
                      {screen.name}
                      <span>
                        {selection.screens.includes(screen.id) && (
                          <Check size={16} />
                        )}
                      </span>
                    </button>
                  ))}
                </fieldset>
              )}
              {!locations.length && <p className="small">{mt("expanded")}</p>}
              <Choices
                legend={t("fields.locationPreference")}
                name="locationPreference"
                options={[
                  "Individual location",
                  "Area / region",
                  "Package",
                  "Need recommendation",
                ]}
                value={values.locationPreference}
                onChange={(value) => update("locationPreference", value)}
              />
              {values.locationPreference === "Package" &&
                (pricing.packages.length ? (
                  <Field label={t("fields.packageId")} name="packageId">
                    <select
                      id="packageId"
                      value={values.packageId || ""}
                      onChange={(event) =>
                        update("packageId", event.target.value)
                      }
                    >
                      <option value="">{common("none")}</option>
                      {pricing.packages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <p className="small">{t("noPackages")}</p>
                ))}
              {station && (
                <p className="selection-note">
                  {t("selectedScreen", {
                    name: `${station.name} / ${station.city}`,
                  })}
                </p>
              )}
              <div className="field-grid">
                <Field label={t("fields.city")} name="city">
                  {input("city")}
                </Field>
                <Field
                  label={t("fields.region")}
                  name="region"
                  error={fieldError("region")}
                >
                  <select
                    id="region"
                    name="region"
                    value={values.region}
                    onChange={(event) => update("region", event.target.value)}
                    aria-invalid={!!errors.region}
                    aria-describedby={
                      errors.region ? "region-error" : undefined
                    }
                  >
                    <option value="">{t("regionOpen")}</option>
                    {map.regions.map((region) => (
                      <option key={region.name}>{region.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={t("fields.notes")} name="notes">
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  maxLength={3000}
                  value={values.notes}
                  onChange={(event) => update("notes", event.target.value)}
                />
              </Field>
              <p className="inline-note">{mt("availability")}</p>
            </div>
          )}
          {step === 3 && (
            <div className="form-stack">
              {values.campaignType === "Special occasion" && (
                <div className="field-grid">
                  <Field label={special("occasion")} name="occasionType">
                    <select
                      id="occasionType"
                      value={values.occasionType || "Custom"}
                      onChange={(event) =>
                        update("occasionType", event.target.value)
                      }
                    >
                      {[
                        "Birthday",
                        "Proposal",
                        "Congratulations",
                        "Opening",
                        "Launch",
                        "Event",
                        "Celebration",
                        "Custom",
                      ].map((occasion) => (
                        <option key={occasion} value={occasion}>
                          {special(occasion)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={special("time")}
                    name="preferredTime"
                    required
                    error={fieldError("preferredTime")}
                  >
                    {input("preferredTime", "time", true)}
                  </Field>
                </div>
              )}
              <div className="field-grid">
                <Field
                  label={t("fields.startDate")}
                  name="startDate"
                  error={fieldError("startDate")}
                >
                  {input("startDate", "date")}
                </Field>
                <Field
                  label={t("fields.endDate")}
                  name="endDate"
                  error={fieldError("endDate")}
                >
                  {input("endDate", "date")}
                </Field>
              </div>
              <p className="inline-note">
                {values.campaignType === "Special occasion"
                  ? t("specialReview")
                  : t("datesOptional")}
              </p>
              {values.campaignType === "Special occasion" && (
                <>
                  <Choices
                    legend={t("fields.duration")}
                    name="duration"
                    options={["5 minutes", "10 minutes", "Custom"]}
                    value={values.duration}
                    onChange={(value) => update("duration", value)}
                  />
                  {values.duration === "Custom" && (
                    <Field
                      label={t("fields.customDuration")}
                      name="customDuration"
                      required
                      error={fieldError("customDuration")}
                    >
                      {input("customDuration", "number", true)}
                    </Field>
                  )}
                </>
              )}
            </div>
          )}
          {step === 4 && (
            <div className="form-stack">
              <div
                className={`upload-area ${dragging ? "dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void chooseFile(event.dataTransfer.files[0]);
                }}
              >
                <UploadCloud size={30} />
                <h3>{fileBusy ? t("checking") : t("dropTitle")}</h3>
                <p>{t("drop")}</p>
                <label className="button button-outline upload-button">
                  {t("browse")}
                  <input
                    id="creative-file"
                    ref={upload}
                    type="file"
                    accept={
                      values.creativeType === "Image"
                        ? "image/jpeg,image/png,image/webp"
                        : "video/mp4,video/webm"
                    }
                    onChange={(event) =>
                      void chooseFile(event.target.files?.[0])
                    }
                    aria-label={t("chooseFile")}
                  />
                </label>
                <small>
                  {values.creativeType === "Image"
                    ? t("imageSpecs")
                    : t("videoSpecs")}
                </small>
              </div>
              {fileError && (
                <p className="field-error" role="alert">
                  {fileError}
                </p>
              )}
              {(file || asset) && (
                <div className="selected-file">
                  {values.creativeType === "Image" ? (
                    <FileImage size={23} />
                  ) : (
                    <FileVideo size={23} />
                  )}
                  <div>
                    <strong>{file?.name || asset?.filename}</strong>
                    <span>
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(2)} MB / `
                        : ""}
                      {asset ? t("storedFile") : t("selectedFile")}
                    </span>
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("removeFile")}
                    title={t("removeFile")}
                    onClick={() => {
                      validationRun.current++;
                      setFile(null);
                      setAsset(null);
                      setSubmitError("");
                      sessionStorage.removeItem("panoAssetId");
                      if (upload.current) upload.current.value = "";
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
              <div className="creative-specs">
                <div>
                  <span className="micro muted">
                    {t("fields.creativeType")}
                  </span>
                  <strong>{common("video")}</strong>
                </div>
                <div>
                  <span className="micro muted">{mt("dimensions")}</span>
                  <strong>{t("dimensions")}</strong>
                </div>
              </div>
              <p className="inline-note">{t("technical")}</p>
            </div>
          )}
          {step === 4 && file && (
            <CreativePreview file={file} screens={selectedScreens} />
          )}
          {step === 4 && (file || asset) && profile && (
            <CreativeModeration
              key={
                file
                  ? `${file.name}:${file.lastModified}:${file.size}`
                  : asset?.id
              }
              file={file}
              values={values}
              campaignId={campaignId}
              onCampaign={(id) => {
                setCampaignId(id);
                sessionStorage.setItem("panoCampaignPlan", initialPlan);
              }}
              onResult={setAsset}
              initialAsset={asset}
            />
          )}
          {step === 4 && !profile && (
            <p className="form-alert" role="status">
              {accountText("gate")}
            </p>
          )}
          {step === 5 && (
            <>
              <div className="request-summary">
                {summary.map((item) => (
                  <section key={item.name}>
                    <div>
                      <span className="micro muted">{item.name}</span>
                      {item.lines.filter(Boolean).map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      title={t("edit", { section: item.name })}
                      aria-label={t("edit", { section: item.name })}
                      disabled={received}
                      onClick={() => go(item.step)}
                    >
                      <Pencil size={16} />
                    </button>
                  </section>
                ))}
              </div>
              <p className="inline-note">
                {t("confirmation")} {t("noPayment")}{" "}
                <Link href="/privacy">{common("privacy")}</Link>.
              </p>
            </>
          )}
          {submitError && (
            <p role="alert" className="form-alert error">
              {submitError}
            </p>
          )}
          {prepared && (
            <div className="prepared-request" role="status">
              <CheckCircle2 size={26} />
              <div>
                <h3>{received ? t("received") : t("prepared")}</h3>
                <p>{received ? t("receivedNote") : t("notSent")}</p>
                <button
                  className="text-link"
                  type="button"
                  onClick={() =>
                    downloadRequest(
                      "PanoVision-campaign-request.json",
                      request(),
                    )
                  }
                >
                  <Download size={17} /> {t("download")}
                </button>
              </div>
            </div>
          )}
          <div className="wizard-actions">
            {step > 0 ? (
              <button
                type="button"
                className="button button-outline"
                disabled={submitting || received}
                onClick={() => go(step - 1)}
              >
                <ArrowLeft size={17} />
                {common("back")}
              </button>
            ) : (
              <Link className="text-link muted" href="/network">
                {common("network")} <ArrowUpRight size={16} />
              </Link>
            )}
            {step < 5 ? (
              <button className="button" type="submit" disabled={fileBusy}>
                {common("next")} <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button"
                type="submit"
                disabled={submitting || received || prepared}
              >
                {submitting
                  ? t("sending")
                  : received
                    ? t("received")
                    : prepared
                      ? t("prepared")
                      : t("send")}
                <ArrowUpRight size={17} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
