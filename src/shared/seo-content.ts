import type { ServiceCategory } from "./service-questionnaires.js";

export type ServiceSeoContent = {
  title: string;
  description: string;
  introduction: string;
  commonJobs: string[];
  projectTips: string[];
  faqs: { question: string; answer: string }[];
};

export const serviceSeoContent: Record<ServiceCategory, ServiceSeoContent> = {
  Handyman: {
    title: "Handyman Services for Home Repairs",
    description:
      "Find handyman professionals for mounting, assembly, minor repairs, and home maintenance. Compare written estimates and project details on Aplime.",
    introduction:
      "A handyman can help combine the small repairs and installations that keep a home working well. Describe each task, share photos, and tell professionals whether materials are already available so estimates can reflect the real scope.",
    commonJobs: [
      "Furniture assembly and wall mounting",
      "Door, cabinet, and hardware adjustments",
      "Drywall patching and minor interior repairs",
      "Shelving, blinds, curtain rods, and fixtures",
      "Seasonal maintenance and punch-list projects",
      "Small accessibility and safety improvements",
    ],
    projectTips: [
      "Group tasks by room and list each item separately.",
      "Include clear photos with a nearby object for scale.",
      "Mention wall materials, ceiling height, and access limitations.",
      "Ask whether the estimate includes hardware, supplies, and cleanup.",
    ],
    faqs: [
      {
        question: "What should I include in a handyman request?",
        answer:
          "List every task, the room or area, approximate dimensions, and any materials you already own. Photos help a professional decide what tools and supplies may be needed.",
      },
      {
        question: "Can I request several small repairs together?",
        answer:
          "Yes. A single detailed list can make it easier to discuss timing and receive one estimate, although a professional may separate tasks that require different materials or visits.",
      },
      {
        question: "How do I compare handyman estimates?",
        answer:
          "Compare labor, materials, exclusions, timing, and cleanup. Confirm whether the estimate is fixed or may change after an on-site inspection.",
      },
    ],
  },
  Cleaning: {
    title: "Home Cleaning Services",
    description:
      "Find home cleaning professionals for recurring, deep, and move-related cleaning. Share room details and compare written estimates on Aplime.",
    introduction:
      "A clear cleaning request explains the size and condition of the space, the rooms that need attention, and any priorities such as appliances or pet hair. Professionals can then explain what is included and how long the visit may take.",
    commonJobs: [
      "Recurring home cleaning",
      "Deep cleaning and seasonal resets",
      "Move-in and move-out cleaning",
      "Kitchen and appliance cleaning",
      "Bathroom cleaning and sanitizing",
      "Post-project dust and surface cleanup",
    ],
    projectTips: [
      "Provide the number of bedrooms, bathrooms, and approximate square footage.",
      "Describe pets, stairs, parking, and building access.",
      "List priority areas and surfaces needing special care.",
      "Confirm whether supplies and equipment are included.",
    ],
    faqs: [
      {
        question: "What is the difference between regular and deep cleaning?",
        answer:
          "Regular cleaning usually covers routine surfaces and floors. Deep cleaning may add detailed work such as baseboards, buildup, cabinet fronts, or selected appliances. Each professional defines the exact scope in the estimate.",
      },
      {
        question: "Should I be home during the cleaning?",
        answer:
          "That is your choice. Agree on arrival, access, pets, and locking instructions in the project conversation before the appointment.",
      },
      {
        question: "How should I prepare for a cleaning visit?",
        answer:
          "Remove valuables and excessive clutter, secure pets, and identify delicate surfaces. Tell the professional about allergies or product preferences before the visit.",
      },
    ],
  },
  Plumbing: {
    title: "Plumbing Services and Repairs",
    description:
      "Find plumbing professionals for leaks, fixtures, drains, and repair projects. Describe symptoms, share photos, and compare estimates on Aplime.",
    introduction:
      "Plumbing symptoms can have more than one cause. Explain where the problem appears, when it started, what has already been tried, and whether water can be shut off. A professional may need an on-site inspection before confirming a final scope.",
    commonJobs: [
      "Leaking faucets, pipes, and fixtures",
      "Toilet repair and replacement",
      "Sink, faucet, and disposal installation",
      "Drain problems and slow drainage",
      "Water heater assessment and replacement",
      "Plumbing fixture upgrades",
    ],
    projectTips: [
      "Share photos of the fixture and the area below or behind it.",
      "Describe water color, sound, pressure, and visible damage.",
      "Mention the approximate age and model of equipment.",
      "Ask about permits and local licensing when applicable.",
    ],
    faqs: [
      {
        question: "Is Aplime an emergency plumbing service?",
        answer:
          "No. For active flooding, gas odor, or immediate danger, leave the affected area and contact emergency services or the appropriate utility. Use Aplime for non-emergency project planning and communication.",
      },
      {
        question: "Can a plumber estimate a repair from photos?",
        answer:
          "Photos and symptoms can help with an initial estimate, but hidden damage or access conditions may require an inspection. Ask what could change the final scope before accepting.",
      },
      {
        question: "What should a plumbing estimate include?",
        answer:
          "Look for labor, parts or fixtures, disposal, permits when needed, exclusions, expected timing, and any workmanship warranty offered by the business.",
      },
    ],
  },
  Electrical: {
    title: "Electrical Services for Home Projects",
    description:
      "Find electrical professionals for outlets, lighting, fixtures, and home projects. Compare scope, timing, and written estimates through Aplime.",
    introduction:
      "Electrical work needs a precise description and may require a licensed professional or permit. Note the affected circuit or fixture, when the issue occurs, and any recent changes. Do not touch exposed wiring or unsafe equipment.",
    commonJobs: [
      "Light fixture and ceiling fan installation",
      "Outlet, switch, and dimmer projects",
      "Troubleshooting intermittent electrical issues",
      "Dedicated circuits and appliance connections",
      "Indoor and outdoor lighting improvements",
      "Electrical panel and capacity assessments",
    ],
    projectTips: [
      "Describe flickering, heat, sounds, odors, or breaker behavior.",
      "Include fixture specifications and installation height.",
      "Ask whether licensing and permits apply to the project.",
      "Keep the area accessible and identify the electrical panel location.",
    ],
    faqs: [
      {
        question: "Is Aplime an emergency electrical service?",
        answer:
          "No. If you see fire, smoke, sparks, or exposed live wiring, keep away and contact emergency services or the electric utility. Do not use the marketplace for immediate hazards.",
      },
      {
        question: "When should I ask about an electrical license?",
        answer:
          "Licensing rules depend on the work and location. Ask the professional for the license type and issuing authority, then verify it with the relevant state or local agency when required.",
      },
      {
        question: "Why might an electrical estimate change after inspection?",
        answer:
          "Existing wiring, panel capacity, code requirements, and access can affect the scope. A written estimate should identify assumptions and explain what could require a revision.",
      },
    ],
  },
  Painting: {
    title: "Interior and Exterior Painting Services",
    description:
      "Find painting professionals for rooms, trim, cabinets, and exterior projects. Share dimensions and finishes, then compare written estimates on Aplime.",
    introduction:
      "A useful painting request covers surface condition, approximate dimensions, colors, finish, preparation, and access. Ask each professional to separate labor and materials and describe how repairs, protection, and cleanup are handled.",
    commonJobs: [
      "Interior walls, ceilings, and trim",
      "Exterior siding and trim",
      "Cabinet and built-in painting",
      "Doors, railings, and accent areas",
      "Surface preparation and minor patching",
      "Rental turnover and move-in painting",
    ],
    projectTips: [
      "List each room and provide approximate wall dimensions.",
      "Photograph peeling, stains, cracks, or previous repairs.",
      "State whether colors are changing from dark to light.",
      "Confirm paint brand, finish, coats, protection, and cleanup.",
    ],
    faqs: [
      {
        question: "What affects the cost of a painting project?",
        answer:
          "Surface area, condition, preparation, ceiling height, color changes, coatings, access, and occupied-space protection can all affect labor and material needs.",
      },
      {
        question: "Who purchases the paint?",
        answer:
          "Either arrangement can work. The estimate should say who supplies paint and materials, which products are included, and how unused materials are handled.",
      },
      {
        question: "How can I compare painting estimates?",
        answer:
          "Compare preparation, repairs, primer, number of coats, product line, surfaces included, protection, cleanup, schedule, and exclusions rather than comparing only the total.",
      },
    ],
  },
  Landscaping: {
    title: "Landscaping and Yard Services",
    description:
      "Find landscaping professionals for lawn care, cleanup, planting, and outdoor improvements. Share property details and compare estimates on Aplime.",
    introduction:
      "Outdoor work changes with property size, terrain, access, season, and disposal needs. Share wide photos, approximate dimensions, and your maintenance goals so professionals can plan labor, equipment, and materials.",
    commonJobs: [
      "Lawn mowing and recurring maintenance",
      "Seasonal cleanup and leaf removal",
      "Planting bed preparation and mulching",
      "Shrub pruning and garden care",
      "Small landscape improvements",
      "Debris removal and property cleanup",
    ],
    projectTips: [
      "Provide lot or work-area dimensions and wide photos.",
      "Describe gates, slopes, parking, and equipment access.",
      "Identify irrigation, pets, utilities, and sensitive plants.",
      "Confirm material quantities, hauling, and disposal.",
    ],
    faqs: [
      {
        question: "What details help with a landscaping estimate?",
        answer:
          "Share the size and condition of the area, access width, slope, desired materials, existing plants, and whether debris should be removed.",
      },
      {
        question: "Can I request recurring yard service?",
        answer:
          "Yes. Describe the desired frequency, seasonal changes, and what each visit should include. Confirm how weather delays and skipped visits are handled.",
      },
      {
        question: "Should materials be itemized?",
        answer:
          "Itemization helps you compare quantities and product choices for plants, soil, mulch, stone, or other materials. Ask about delivery and unused materials too.",
      },
    ],
  },
};

export const informationalPages = {
  "/about": {
    title: "About Aplime",
    description:
      "Learn how Aplime helps customers and home-service professionals manage requests, estimates, conversations, scheduling, and project updates.",
    heading: "Home-service decisions deserve a clearer place.",
  },
  "/how-it-works": {
    title: "How Aplime Works",
    description:
      "Learn how to create a home-service request, compare professional profiles and estimates, schedule work, and keep project updates together.",
    heading: "From a project idea to a confirmed finish.",
  },
  "/for-professionals": {
    title: "Aplime for Home-Service Professionals",
    description:
      "Build a reviewed business profile, receive relevant local opportunities, send written estimates, and manage customer communication with Aplime.",
    heading: "A professional workspace built around clear expectations.",
  },
  "/trust-and-safety": {
    title: "Trust and Safety at Aplime",
    description:
      "Understand Aplime identity verification, business-profile review, private communication, reporting, and safer home-service practices.",
    heading: "Know what Aplime checks and what you should confirm.",
  },
} as const;

export const seoStaticPaths = [
  "/services",
  ...Object.keys(informationalPages),
] as string[];
