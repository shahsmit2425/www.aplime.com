import { z } from "zod";
export const businessFields = [
  { key: "legalName", label: "Legal business name", required: true },
  { key: "phone", label: "Public business phone", required: true },
  {
    key: "email",
    label: "Public business email",
    required: true,
    type: "email",
  },
  { key: "website", label: "Website (optional, https://)", type: "url" },
  { key: "city", label: "Business city", required: true },
  { key: "state", label: "State / region", required: true },
  { key: "serviceAreas", label: "Cities and ZIP codes served", required: true },
  {
    key: "specialties",
    label: "Specialties and services offered",
    required: true,
  },
  { key: "languages", label: "Languages spoken", required: true },
  { key: "hours", label: "Working hours and time zone", required: true },
  {
    key: "license",
    label: "License type, number and issuing authority (if applicable)",
  },
  {
    key: "insurance",
    label: "Insurance coverage and expiration (if applicable)",
  },
  { key: "qualifications", label: "Training and certifications (optional)" },
  { key: "warranty", label: "Workmanship warranty / guarantee (optional)" },
  {
    key: "cancellationPolicy",
    label: "Appointment cancellation policy",
    required: true,
  },
] as const;
const short = z.string().trim().max(1000).default("");
export const businessDetailsSchema = z
  .object({
    legalName: z.string().trim().max(150).default(""),
    phone: z
      .string()
      .trim()
      .regex(/^[+()\d .-]{7,30}$/, "Enter a business phone number"),
    email: z.string().trim().email().max(254),
    website: z
      .union([z.literal(""), z.string().url().startsWith("https://")])
      .default(""),
    city: z.string().trim().max(100).default(""),
    state: z.string().trim().max(100).default(""),
    serviceAreas: short,
    specialties: short,
    languages: z.string().trim().max(200).default(""),
    hours: z.string().trim().max(500).default(""),
    license: short,
    insurance: short,
    qualifications: short,
    warranty: short,
    cancellationPolicy: short,
    yearsExperience: z.number().int().min(0).max(100).optional(),
    teamSize: z.number().int().min(1).max(10000).optional(),
    businessType: z
      .enum(["Sole proprietor", "LLC", "Corporation", "Partnership", "Other"])
      .optional(),
  })
  .strict();
export type BusinessDetails = z.infer<typeof businessDetailsSchema>;

export const businessFieldGroups = [
  {
    title: "Contact & location",
    description:
      "Use contact information that you want customers to see. Your base street address is private and used only for matching.",
    keys: ["legalName", "phone", "email", "website", "city", "state"],
  },
  {
    title: "Services & coverage",
    description: "Tell customers where you work and the jobs you do best.",
    keys: ["serviceAreas", "specialties", "languages"],
  },
  {
    title: "Hours & customer policies",
    description:
      "Set clear expectations before a customer requests an estimate.",
    keys: ["hours", "cancellationPolicy", "warranty"],
  },
  {
    title: "Credentials & qualifications",
    description:
      "These are self-reported business details. Identity verification does not verify a license or insurance policy.",
    keys: ["license", "insurance", "qualifications"],
  },
] as const;
