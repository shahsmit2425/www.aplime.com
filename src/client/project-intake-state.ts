import { z } from "zod";
import {
  categories,
  questionsFor,
  type ServiceCategory,
} from "../shared/service-questionnaires.js";
import { projectSchema } from "../shared/domain.js";
export const INTAKE_TTL = 24 * 60 * 60_000;
export const INTAKE_KEY = "aplime-project-intake-v1";
export const INTAKE_RESUME = "aplime-project-intake-resume";
const draftSchema = z.object({
  zip: z.string().max(5).default(""),
  zipLabel: z.string().max(300).default(""),
  addressZip: z.string().max(5).default(""),
  category: z.enum(categories).default("Handyman"),
  intake: z.record(z.string().max(64), z.string().max(1500)).default({}),
  title: z.string().max(120).default(""),
  description: z.string().max(4000).default(""),
  address: z.string().max(300).default(""),
  placeId: z.string().max(300).default(""),
  addressUnit: z.string().max(100).default(""),
  urgency: z
    .enum(["urgent", "this_week", "this_month", "flexible", ""])
    .default(""),
  propertyType: z
    .enum(["home", "apartment", "condo", "commercial", "other"])
    .default("home"),
  budgetMin: z.number().int().min(0).max(10000000).nullable().default(null),
  budgetMax: z.number().int().min(0).max(10000000).nullable().default(null),
  proId: z.string().max(128).nullable().default(null),
});
export type IntakeDraft = z.infer<typeof draftSchema>;
export function initialIntake(value: unknown = {}) {
  const parsed = draftSchema.safeParse(value);
  return parsed.success ? parsed.data : draftSchema.parse({});
}
export function intakeQuestions(category: ServiceCategory) {
  const questions = [...questionsFor(category)];
  if (!questions.some((q) => q.id === "propertyType"))
    questions.push({
      id: "propertyType",
      label: "What type of property is it?",
      type: "select",
      required: true,
      options: [
        "Single-family home",
        "Apartment or condo",
        "Townhome",
        "Commercial property",
        "Other",
      ],
    });
  return questions;
}
export function intakeSteps(draft: IntakeDraft) {
  return [
    "zip",
    "category",
    ...intakeQuestions(draft.category).map((q) => "question:" + q.id),
    "timing",
    "budget",
    "notes",
    "address",
    "unit",
    "photos",
    "review",
  ];
}
export function projectPayload(draft: IntakeDraft) {
  const questions = questionsFor(draft.category);
  const property = draft.intake.propertyType || "";
  const description =
    draft.description.trim() ||
    `I need help with a ${draft.category.toLowerCase()} project. ` +
      questions
        .map((q) => `${q.label}: ${draft.intake[q.id] || "Not specified"}.`)
        .join(" ");
  return {
    title: draft.title.trim() || `${draft.category} project`,
    description: description.slice(0, 4000),
    category: draft.category,
    intake: Object.fromEntries(
      questions.map((q) => [q.id, draft.intake[q.id]]).filter(([, v]) => v),
    ),
    placeId: draft.placeId,
    address: draft.address,
    addressUnit: draft.addressUnit,
    urgency: draft.urgency || "flexible",
    propertyType: property.includes("Commercial")
      ? "commercial"
      : property.includes("Apartment")
        ? "apartment"
        : property.startsWith("Other")
          ? "other"
          : "home",
    budgetMin: draft.budgetMin,
    budgetMax: draft.budgetMax,
    proId: draft.proId,
    scheduledAt: null,
  };
}
export function stepProblem(step: string, draft: IntakeDraft): string {
  if (step === "zip" && (!/^\d{5}$/.test(draft.zip) || !draft.zipLabel))
    return "Check your five-digit New Jersey ZIP code to continue.";
  if (step.startsWith("question:")) {
    const q = intakeQuestions(draft.category).find(
      (q) => q.id === step.slice(9),
    );
    const answer = draft.intake[q?.id || ""]?.trim() || "";
    if (q?.required && answer.length < 2)
      return "Choose an answer or enter a few details.";
    if (
      answer === "Other" ||
      (answer.startsWith("Other:") && answer.slice(6).trim().length < 2)
    )
      return "Tell us a little more about your answer.";
    if (
      q?.options &&
      !q.options.includes(answer) &&
      !/^Other: .{2,1493}$/s.test(answer)
    )
      return "Choose an answer or use Other to describe it.";
  }
  if (step === "timing" && !draft.urgency)
    return "Choose when you would like help.";
  if (
    step === "budget" &&
    draft.budgetMin !== null &&
    draft.budgetMax !== null &&
    draft.budgetMin > draft.budgetMax
  )
    return "Your maximum budget must be at least your minimum.";
  if (
    step === "notes" &&
    draft.description.trim() &&
    draft.description.trim().length < 20
  )
    return "Please enter at least 20 characters, or leave the notes blank.";
  if (step === "address" && (!draft.placeId || !draft.addressZip))
    return "Select a complete address from the suggestions.";
  if (step === "address" && draft.addressZip !== draft.zip)
    return "This address has a different ZIP. Go back and update the ZIP or choose another address.";
  return "";
}
export function firstInvalidStep(draft: IntakeDraft) {
  return (
    intakeSteps(draft).find((step) => stepProblem(step, draft)) ||
    (projectSchema.safeParse(projectPayload(draft)).success ? null : "review")
  );
}
const envelopeSchema = z.object({
  version: z.literal(1),
  updatedAt: z.number(),
  owner: z.string().nullable(),
  draft: draftSchema,
  step: z.string().max(80),
  photoKey: z.string().uuid(),
  clientKey: z.string().uuid(),
  signature: z.string().max(30000).default(""),
  savedProjectId: z.string().uuid().nullable().default(null),
  draftUpdatedAt: z.string().optional(),
  photoCount: z.number().int().min(0).max(5).default(0),
});
export type IntakeSession = z.infer<typeof envelopeSchema>;
export function parseIntakeSession(
  raw: string | null,
  owner: string | null,
  now = Date.now(),
) {
  try {
    if (!raw || raw.length > 65000) return null;
    const result = envelopeSchema.safeParse(JSON.parse(raw));
    if (
      !result.success ||
      now - result.data.updatedAt > INTAKE_TTL ||
      result.data.updatedAt > now + 60000
    )
      return null;
    if (result.data.owner && result.data.owner !== owner) return null;
    return {
      ...result.data,
      step: intakeSteps(result.data.draft).includes(result.data.step)
        ? result.data.step
        : "zip",
    };
  } catch {
    return null;
  }
}
export function hasIntakeResume() {
  try {
    return (
      sessionStorage.getItem(INTAKE_RESUME) === "yes" &&
      !!parseIntakeSession(sessionStorage.getItem(INTAKE_KEY), null)
    );
  } catch {
    return false;
  }
}

export function intakeBudgetChoice(
  draft: Pick<IntakeDraft, "budgetMin" | "budgetMax">,
) {
  if (draft.budgetMin === null && draft.budgetMax === null)
    return "I’d like advice / Not sure";
  if (draft.budgetMin === null && draft.budgetMax === 50000)
    return "Under $500";
  if (draft.budgetMin === 50000 && draft.budgetMax === 200000)
    return "$500–$2,000";
  if (draft.budgetMin === 200000 && draft.budgetMax === 500000)
    return "$2,000–$5,000";
  return "Set my own budget";
}
