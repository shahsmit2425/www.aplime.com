export const categories = [
  "Handyman",
  "Cleaning",
  "Plumbing",
  "Electrical",
  "Painting",
  "Landscaping",
] as const;

export type ServiceCategory = (typeof categories)[number];
export type ServiceQuestion = {
  id: string;
  label: string;
  help?: string;
  type: "select" | "text" | "textarea";
  options?: readonly string[];
  placeholder?: string;
  required?: boolean;
};

const propertyTypes = [
  "Single-family home",
  "Apartment or condo",
  "Townhome",
  "Commercial property",
  "Other",
] as const;

export const serviceQuestionnaires: Record<
  ServiceCategory,
  readonly ServiceQuestion[]
> = {
  Handyman: [
    { id: "task", label: "What kind of help do you need?", type: "select", options: ["Assembly", "Mounting or installation", "Door or window repair", "Drywall repair", "General home repairs", "Several small tasks", "Other"], required: true },
    { id: "area", label: "Where is the work?", type: "select", options: ["Kitchen", "Bathroom", "Bedroom", "Living area", "Garage or basement", "Exterior", "Several areas"], required: true },
    { id: "propertyType", label: "Property type", type: "select", options: propertyTypes, required: true },
    { id: "materials", label: "What is the materials situation?", type: "select", options: ["I already have everything", "I have some materials", "Professional should supply materials", "I need advice first"], required: true },
    { id: "scope", label: "List the items, measurements, or quantities", type: "textarea", placeholder: "Example: mount one 55-inch TV on drywall and assemble two shelves", required: true },
  ],
  Cleaning: [
    { id: "cleaningType", label: "What type of cleaning do you need?", type: "select", options: ["Standard cleaning", "Deep cleaning", "Move-in or move-out", "Post-construction", "Carpet or upholstery", "Office or commercial", "Other"], required: true },
    { id: "propertyType", label: "Property type", type: "select", options: propertyTypes, required: true },
    { id: "size", label: "Approximate size", type: "select", options: ["Under 1,000 sq ft", "1,000–1,999 sq ft", "2,000–2,999 sq ft", "3,000+ sq ft", "Not sure"], required: true },
    { id: "rooms", label: "Bedrooms and bathrooms", type: "text", placeholder: "Example: 3 bedrooms, 2 bathrooms", required: true },
    { id: "frequency", label: "How often?", type: "select", options: ["One time", "Weekly", "Every two weeks", "Monthly", "Not sure yet"], required: true },
    { id: "pets", label: "Will pets be present?", type: "select", options: ["No pets", "Pets will be secured", "Pets may be present"], required: true },
  ],
  Plumbing: [
    { id: "issue", label: "What plumbing help do you need?", type: "select", options: ["Active leak", "Clogged drain or toilet", "Fixture installation", "Water heater", "Low water pressure", "Pipe repair or replacement", "Inspection or diagnosis", "Other"], required: true },
    { id: "affectedArea", label: "What is affected?", type: "text", placeholder: "Example: kitchen sink and cabinet below it", required: true },
    { id: "waterStatus", label: "What is happening now?", type: "select", options: ["Water is shut off", "Leak is contained", "Slow leak", "No active leak", "Water is spreading or cannot be stopped"], required: true },
    { id: "propertyType", label: "Property type", type: "select", options: propertyTypes, required: true },
    { id: "history", label: "When did it start and what have you tried?", type: "textarea", placeholder: "Include any previous repairs or troubleshooting", required: true },
  ],
  Electrical: [
    { id: "issue", label: "What electrical help do you need?", type: "select", options: ["Outlet or switch", "Light fixture or ceiling fan", "Circuit breaker or panel", "Loss of power", "Wiring or rewiring", "EV charger", "Inspection or diagnosis", "Other"], required: true },
    { id: "powerStatus", label: "Current condition", type: "select", options: ["Working but needs an upgrade", "Intermittent problem", "Not working", "Breaker repeatedly trips", "Sparks, smoke, heat, or burning smell"], required: true },
    { id: "propertyType", label: "Property type", type: "select", options: propertyTypes, required: true },
    { id: "panel", label: "Do you know the electrical panel location and amperage?", type: "text", placeholder: "Example: basement, 200 amp — or Not sure", required: true },
    { id: "scope", label: "Describe the fixtures, circuits, and quantities", type: "textarea", placeholder: "Example: replace four outlets in the kitchen", required: true },
  ],
  Painting: [
    { id: "paintArea", label: "What should be painted?", type: "select", options: ["Interior rooms", "Exterior", "Cabinets", "Doors or trim", "Ceiling", "Fence or deck", "Other"], required: true },
    { id: "size", label: "How large is the project?", type: "text", placeholder: "Example: two 12 × 14 rooms or 1,800 sq ft exterior", required: true },
    { id: "surface", label: "Surface condition", type: "select", options: ["Good condition", "Minor holes or cracks", "Peeling or damaged", "Wallpaper must be removed", "Water stains or possible moisture", "Not sure"], required: true },
    { id: "paint", label: "Who will provide paint and supplies?", type: "select", options: ["I will provide them", "Professional should provide them", "I need color or product advice", "Not sure"], required: true },
    { id: "occupancy", label: "Will rooms be furnished or occupied?", type: "select", options: ["Empty", "Furnished", "Occupied during work", "Flexible"], required: true },
  ],
  Landscaping: [
    { id: "service", label: "What outdoor service do you need?", type: "select", options: ["Lawn mowing", "Seasonal cleanup", "Trimming or pruning", "Garden design or planting", "Mulch or sod", "Drainage or grading", "Fence or hardscape", "Other"], required: true },
    { id: "propertySize", label: "Approximate outdoor area", type: "select", options: ["Under 1/8 acre", "1/8–1/4 acre", "1/4–1/2 acre", "1/2–1 acre", "Over 1 acre", "Not sure"], required: true },
    { id: "frequency", label: "Is this recurring work?", type: "select", options: ["One time", "Weekly", "Every two weeks", "Monthly", "Seasonal", "Not sure yet"], required: true },
    { id: "access", label: "How can the professional access the area?", type: "select", options: ["Open access", "Standard gate", "Narrow gate", "Stairs or slope", "Access must be arranged"], required: true },
    { id: "debris", label: "Should debris or clippings be removed?", type: "select", options: ["Yes", "No", "Please quote both options", "Not applicable"], required: true },
    { id: "details", label: "Describe current conditions and your desired result", type: "textarea", placeholder: "Mention overgrowth, damaged areas, preferred plants, or other useful details", required: true },
  ],
};

export function questionsFor(category: ServiceCategory) {
  return serviceQuestionnaires[category];
}

export function questionLabel(category: ServiceCategory, id: string) {
  return questionsFor(category).find((question) => question.id === id)?.label || id;
}
