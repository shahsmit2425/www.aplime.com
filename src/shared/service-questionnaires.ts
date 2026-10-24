export const categories = [
  "Handyman",
  "Cleaning",
  "Plumbing",
  "Electrical",
  "Painting",
  "Landscaping",
  "Junk Removal",
  "HVAC",
  "Roofing",
  "Tree Services",
  "Appliance Repair",
  "Pest Control",
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
    {
      id: "task",
      label: "What kind of help do you need?",
      type: "select",
      options: [
        "Assembly",
        "Mounting or installation",
        "Door or window repair",
        "Drywall repair",
        "General home repairs",
        "Several small tasks",
        "Other",
      ],
      required: true,
    },
    {
      id: "area",
      label: "Where is the work?",
      type: "select",
      options: [
        "Kitchen",
        "Bathroom",
        "Bedroom",
        "Living area",
        "Garage or basement",
        "Exterior",
        "Several areas",
      ],
      required: true,
    },
    {
      id: "propertyType",
      label: "Property type",
      type: "select",
      options: propertyTypes,
      required: true,
    },
    {
      id: "materials",
      label: "What is the materials situation?",
      type: "select",
      options: [
        "I already have everything",
        "I have some materials",
        "Professional should supply materials",
        "I need advice first",
      ],
      required: true,
    },
    {
      id: "scope",
      label: "List the items, measurements, or quantities",
      type: "textarea",
      placeholder:
        "Example: mount one 55-inch TV on drywall and assemble two shelves",
      required: true,
    },
  ],
  Cleaning: [
    {
      id: "cleaningType",
      label: "What type of cleaning do you need?",
      type: "select",
      options: [
        "Standard cleaning",
        "Deep cleaning",
        "Move-in or move-out",
        "Post-construction",
        "Carpet or upholstery",
        "Office or commercial",
        "Other",
      ],
      required: true,
    },
    {
      id: "propertyType",
      label: "Property type",
      type: "select",
      options: propertyTypes,
      required: true,
    },
    {
      id: "size",
      label: "Approximate size",
      type: "select",
      options: [
        "Under 1,000 sq ft",
        "1,000–1,999 sq ft",
        "2,000–2,999 sq ft",
        "3,000+ sq ft",
        "Not sure",
      ],
      required: true,
    },
    {
      id: "rooms",
      label: "Bedrooms and bathrooms",
      type: "text",
      placeholder: "Example: 3 bedrooms, 2 bathrooms",
      required: true,
    },
    {
      id: "frequency",
      label: "How often?",
      type: "select",
      options: [
        "One time",
        "Weekly",
        "Every two weeks",
        "Monthly",
        "Not sure yet",
      ],
      required: true,
    },
    {
      id: "pets",
      label: "Will pets be present?",
      type: "select",
      options: ["No pets", "Pets will be secured", "Pets may be present"],
      required: true,
    },
  ],
  Plumbing: [
    {
      id: "issue",
      label: "What plumbing help do you need?",
      type: "select",
      options: [
        "Active leak",
        "Clogged drain or toilet",
        "Fixture installation",
        "Water heater",
        "Low water pressure",
        "Pipe repair or replacement",
        "Inspection or diagnosis",
        "Other",
      ],
      required: true,
    },
    {
      id: "affectedArea",
      label: "What is affected?",
      type: "text",
      placeholder: "Example: kitchen sink and cabinet below it",
      required: true,
    },
    {
      id: "waterStatus",
      label: "What is happening now?",
      type: "select",
      options: [
        "Water is shut off",
        "Leak is contained",
        "Slow leak",
        "No active leak",
        "Water is spreading or cannot be stopped",
      ],
      required: true,
    },
    {
      id: "propertyType",
      label: "Property type",
      type: "select",
      options: propertyTypes,
      required: true,
    },
    {
      id: "history",
      label: "When did it start and what have you tried?",
      type: "textarea",
      placeholder: "Include any previous repairs or troubleshooting",
      required: true,
    },
  ],
  Electrical: [
    {
      id: "issue",
      label: "What electrical help do you need?",
      type: "select",
      options: [
        "Outlet or switch",
        "Light fixture or ceiling fan",
        "Circuit breaker or panel",
        "Loss of power",
        "Wiring or rewiring",
        "EV charger",
        "Inspection or diagnosis",
        "Other",
      ],
      required: true,
    },
    {
      id: "powerStatus",
      label: "Current condition",
      type: "select",
      options: [
        "Working but needs an upgrade",
        "Intermittent problem",
        "Not working",
        "Breaker repeatedly trips",
        "Sparks, smoke, heat, or burning smell",
      ],
      required: true,
    },
    {
      id: "propertyType",
      label: "Property type",
      type: "select",
      options: propertyTypes,
      required: true,
    },
    {
      id: "panel",
      label: "Do you know the electrical panel location and amperage?",
      type: "text",
      placeholder: "Example: basement, 200 amp — or Not sure",
      required: true,
    },
    {
      id: "scope",
      label: "Describe the fixtures, circuits, and quantities",
      type: "textarea",
      placeholder: "Example: replace four outlets in the kitchen",
      required: true,
    },
  ],
  Painting: [
    {
      id: "paintArea",
      label: "What should be painted?",
      type: "select",
      options: [
        "Interior rooms",
        "Exterior",
        "Cabinets",
        "Doors or trim",
        "Ceiling",
        "Fence or deck",
        "Other",
      ],
      required: true,
    },
    {
      id: "size",
      label: "How large is the project?",
      type: "text",
      placeholder: "Example: two 12 × 14 rooms or 1,800 sq ft exterior",
      required: true,
    },
    {
      id: "surface",
      label: "Surface condition",
      type: "select",
      options: [
        "Good condition",
        "Minor holes or cracks",
        "Peeling or damaged",
        "Wallpaper must be removed",
        "Water stains or possible moisture",
        "Not sure",
      ],
      required: true,
    },
    {
      id: "paint",
      label: "Who will provide paint and supplies?",
      type: "select",
      options: [
        "I will provide them",
        "Professional should provide them",
        "I need color or product advice",
        "Not sure",
      ],
      required: true,
    },
    {
      id: "occupancy",
      label: "Will rooms be furnished or occupied?",
      type: "select",
      options: ["Empty", "Furnished", "Occupied during work", "Flexible"],
      required: true,
    },
  ],
  Landscaping: [
    {
      id: "service",
      label: "What outdoor service do you need?",
      type: "select",
      options: [
        "Lawn mowing",
        "Seasonal cleanup",
        "Trimming or pruning",
        "Garden design or planting",
        "Mulch or sod",
        "Drainage or grading",
        "Fence or hardscape",
        "Other",
      ],
      required: true,
    },
    {
      id: "propertySize",
      label: "Approximate outdoor area",
      type: "select",
      options: [
        "Under 1/8 acre",
        "1/8–1/4 acre",
        "1/4–1/2 acre",
        "1/2–1 acre",
        "Over 1 acre",
        "Not sure",
      ],
      required: true,
    },
    {
      id: "frequency",
      label: "Is this recurring work?",
      type: "select",
      options: [
        "One time",
        "Weekly",
        "Every two weeks",
        "Monthly",
        "Seasonal",
        "Not sure yet",
      ],
      required: true,
    },
    {
      id: "access",
      label: "How can the professional access the area?",
      type: "select",
      options: [
        "Open access",
        "Standard gate",
        "Narrow gate",
        "Stairs or slope",
        "Access must be arranged",
      ],
      required: true,
    },
    {
      id: "debris",
      label: "Should debris or clippings be removed?",
      type: "select",
      options: ["Yes", "No", "Please quote both options", "Not applicable"],
      required: true,
    },
    {
      id: "details",
      label: "Describe current conditions and your desired result",
      type: "textarea",
      placeholder:
        "Mention overgrowth, damaged areas, preferred plants, or other useful details",
      required: true,
    },
  ],
  "Junk Removal": [
    {
      id: "items",
      label: "What needs to be removed?",
      type: "select",
      required: true,
      options: [
        "Furniture",
        "Appliances",
        "Household clutter",
        "Yard debris",
        "Renovation debris",
        "Other",
      ],
    },
    {
      id: "amount",
      label: "How much needs removing?",
      type: "select",
      required: true,
      options: [
        "One item",
        "A few items",
        "One room",
        "Multiple rooms",
        "Not sure",
      ],
    },
    {
      id: "access",
      label: "Where are the items?",
      type: "select",
      required: true,
      options: [
        "Curbside or driveway",
        "Ground floor",
        "Upstairs",
        "Basement",
        "Other",
      ],
    },
  ],
  HVAC: [
    {
      id: "service",
      label: "What help do you need?",
      type: "select",
      required: true,
      options: [
        "Repair",
        "Maintenance",
        "Installation or replacement",
        "Inspection",
        "Other",
      ],
    },
    {
      id: "system",
      label: "Which system needs attention?",
      type: "select",
      required: true,
      options: [
        "Central air conditioning",
        "Furnace",
        "Heat pump",
        "Boiler",
        "Ductless system",
        "Not sure",
      ],
    },
    {
      id: "condition",
      label: "What is happening?",
      type: "select",
      required: true,
      options: [
        "Not heating",
        "Not cooling",
        "Unusual noise",
        "Routine service",
        "Planning an upgrade",
        "Other",
      ],
    },
  ],
  Roofing: [
    {
      id: "service",
      label: "What roofing work do you need?",
      type: "select",
      required: true,
      options: [
        "Leak repair",
        "Other repair",
        "Roof replacement",
        "Inspection",
        "Other",
      ],
    },
    {
      id: "material",
      label: "What type of roof do you have?",
      type: "select",
      required: true,
      options: [
        "Asphalt shingles",
        "Flat roof",
        "Metal",
        "Tile or slate",
        "Not sure",
      ],
    },
    {
      id: "height",
      label: "How many stories is the building?",
      type: "select",
      required: true,
      options: ["One", "Two", "Three or more", "Not sure"],
    },
  ],
  "Tree Services": [
    {
      id: "service",
      label: "What tree work do you need?",
      type: "select",
      required: true,
      options: [
        "Trimming or pruning",
        "Tree removal",
        "Stump removal",
        "Tree health assessment",
        "Other",
      ],
    },
    {
      id: "quantity",
      label: "How many trees or stumps?",
      type: "select",
      required: true,
      options: ["One", "Two or three", "Four or more", "Not sure"],
    },
    {
      id: "access",
      label: "What is near the work area?",
      type: "select",
      required: true,
      options: [
        "Open yard",
        "House or other structure",
        "Fence or narrow access",
        "Power lines",
        "Not sure",
      ],
    },
  ],
  "Appliance Repair": [
    {
      id: "appliance",
      label: "Which appliance needs repair?",
      type: "select",
      required: true,
      options: [
        "Refrigerator",
        "Washer",
        "Dryer",
        "Dishwasher",
        "Oven or range",
        "Other",
      ],
    },
    {
      id: "issue",
      label: "What is the main issue?",
      type: "select",
      required: true,
      options: [
        "Will not start",
        "Not working correctly",
        "Leaking",
        "Unusual noise",
        "Not sure",
      ],
    },
    {
      id: "brand",
      label: "Do you know the brand or model?",
      type: "text",
      required: false,
      placeholder: "Brand or model, if known",
    },
  ],
  "Pest Control": [
    {
      id: "pest",
      label: "What are you noticing?",
      type: "select",
      required: true,
      options: [
        "Ants",
        "Rodents",
        "Cockroaches",
        "Termites",
        "Bed bugs",
        "Wasps or hornets",
        "Not sure",
        "Other",
      ],
    },
    {
      id: "area",
      label: "Where have you noticed activity?",
      type: "select",
      required: true,
      options: ["Inside", "Outside", "Both", "Not sure"],
    },
    {
      id: "frequency",
      label: "What type of service do you need?",
      type: "select",
      required: true,
      options: [
        "One-time treatment",
        "Recurring prevention",
        "Inspection",
        "Not sure",
      ],
    },
  ],
};

export function questionsFor(category: ServiceCategory) {
  return serviceQuestionnaires[category];
}

export function questionLabel(category: ServiceCategory, id: string) {
  return (
    questionsFor(category).find((question) => question.id === id)?.label || id
  );
}

export function serviceSlug(category: string) {
  return category.toLowerCase().replace(/\s+/g, "-");
}
