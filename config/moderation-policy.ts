export type PolicyAction = "reject" | "manual_review" | "allow";
export type PolicyRule = {
  action: PolicyAction;
  description: string;
  rejectThreshold: number;
  reviewThreshold: number;
  critical?: boolean;
};
const reject = (description: string, critical = false): PolicyRule => ({
  action: "reject",
  description,
  rejectThreshold: 0.9,
  reviewThreshold: 0.3,
  critical,
});
const review = (description: string): PolicyRule => ({
  action: "manual_review",
  description,
  rejectThreshold: 0.9,
  reviewThreshold: 0.3,
});

// Bump the version when changing policy. A content fingerprint also invalidates
// old approvals if someone forgets to change this label.
export const policyVersion = "PANO_POLICY_2026_01";
export const moderationRules: Record<string, PolicyRule> = {
  EXPLICIT_NUDITY: reject(
    "Explicit nudity, exposed genitals or breasts prohibited by platform policy.",
  ),
  EXPLICIT_SEXUAL_CONTENT: reject(
    "Pornography, explicit sexual activity or explicit sexual imagery/text.",
  ),
  SEXUAL_CONTENT_MINORS: reject(
    "Sexual content involving or appearing to involve minors. Treat uncertainty about age as a concern.",
    true,
  ),
  GRAPHIC_VIOLENCE: reject(
    "Graphic gore, dismemberment, severe wounds or graphic corpses.",
  ),
  HATEFUL_CONTENT: reject(
    "Dehumanizing attacks or slurs against protected groups, including calls for violence.",
  ),
  EXTREMIST_PROMOTION: reject(
    "Extremist or terrorist recruitment, praise or promotional propaganda. Distinguish reporting from promotion.",
  ),
  DRUG_PROMOTION: reject(
    "Promotion or sale of controlled illicit drugs, prohibited by PanoVision policy.",
  ),
  WEAPONS_PROMOTION: reject(
    "Promotional advertising for weapons or ammunition, prohibited by PanoVision policy.",
  ),
  PROHIBITED_GOODS: reject(
    "Promotion of goods or services prohibited by explicitly configured PanoVision rules. If unclear, flag uncertainty.",
  ),
  THREATS: reject("Direct threats or encouragement of physical violence."),
  SELF_HARM_PROMOTION: reject(
    "Promotion or instructions for suicide or self-harm.",
  ),
  SUGGESTIVE: review(
    "Suggestive but non-explicit imagery, swimwear or lingerie.",
  ),
  MEDICAL: review("Medical imagery, procedures or treatment advertising."),
  POLITICAL: review(
    "Political advertising, election messaging or political advocacy.",
  ),
  RELIGIOUS: review("Religious advertising or advocacy."),
  ALCOHOL: review("Advertising alcoholic products."),
  TOBACCO: review("Tobacco, nicotine or vaping advertising."),
  GAMBLING: review("Gambling, betting or casino promotion."),
  PHARMACEUTICALS: review(
    "Pharmaceutical, medicine or supplement advertising.",
  ),
  EDITORIAL_VIOLENCE: review(
    "Weapons, violence or protest imagery in editorial, educational or news context.",
  ),
  RIGHTS_QUESTION: review(
    "Potential third-party copyrighted assets, recognizable trademarks, celebrity likenesses or licensing questions. Do not assume permission or infringement.",
  ),
  MISLEADING_CLAIMS: review(
    "Potentially misleading, unsubstantiated or unverifiable advertising claims.",
  ),
  FINANCIAL_CLAIMS: review(
    "Financial products, investment, income or returns claims.",
  ),
  HEALTH_CLAIMS: review("Health benefits, cure, wellness or treatment claims."),
  LEGAL_CLAIMS: review(
    "Legal services, legal outcomes or legal compliance claims.",
  ),
  CONTROVERSIAL_SOCIAL: review(
    "Context-dependent or controversial social advocacy.",
  ),
};
