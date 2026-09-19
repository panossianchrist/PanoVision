export const company = {
  name: "PanoVision",
  tagline: "WHERE BRANDS GET SEEN.",
  country: "Lebanon",
  email: "panovision@gmail.com",
  instagramHandle: "@PanoVisionlb",
  instagram: "https://www.instagram.com/PanoVisionlb/",
  whatsappNumber: "",
  whatsappMessages: {
    en: "Hello PanoVision, I'd like to ask about an advertising campaign.",
    fr: "Bonjour PanoVision, je souhaite me renseigner sur une campagne publicitaire.",
    ar: "مرحباً PanoVision، أود الاستفسار عن حملة إعلانية.",
  },
  phone: "", // Add your real Lebanese or international phone number here.
  logo: "/brand/panovision-logo.webp",
  // The same official logo with its baked-in navy background removed (see scripts/prepare-visuals.mjs).
  logoTransparent: "/brand/panovision-logo-hero.webp",
  conceptImage: "/images/canopy-concept.webp",
  // Drafts are stored at upload; final requests require an approved current creative.
  submissionMode: "connected" as "demo" | "connected",
};

export const hasRealEmail = !company.email.startsWith("YOUR_");

export function whatsappLink(locale: string, number = company.whatsappNumber) {
  if (!/^\+?[\d ()-]+$/.test(number.trim())) return null;
  const digits = number.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  const message = company.whatsappMessages[locale as keyof typeof company.whatsappMessages] || company.whatsappMessages.en;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
