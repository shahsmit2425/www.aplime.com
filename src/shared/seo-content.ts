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
  "Junk Removal": {
    title: "Junk Removal and Hauling",
    description:
      "Arrange pickup for unwanted furniture, appliances, clutter, and debris. Share your New Jersey project and compare estimates on Aplime.",
    introduction:
      "Arrange pickup for unwanted furniture, appliances, clutter, and debris. Share photos, item sizes, stairs, and parking access. Confirm disposal fees and which materials the professional accepts.",
    commonJobs: [
      "Furniture and appliance pickup",
      "Garage and basement cleanouts",
      "Yard and renovation debris removal",
    ],
    projectTips: [
      "Share photos, item sizes, stairs, and parking access. Confirm disposal fees and which materials the professional accepts.",
      "Confirm the scope, price, and expected timing before agreeing to the work.",
    ],
    faqs: [
      {
        question: "What should I include in my request?",
        answer:
          "Share photos, item sizes, stairs, and parking access. Confirm disposal fees and which materials the professional accepts.",
      },
      {
        question: "Does posting a project book a service?",
        answer:
          "No. Posting lets you discuss your project with matching professionals. Availability varies by location. Agree on the work and timing before booking.",
      },
    ],
  },
  HVAC: {
    title: "Heating and Air Conditioning Services",
    description:
      "Find help with heating, cooling, maintenance, and system replacement. Share your New Jersey project and compare estimates on Aplime.",
    introduction:
      "Find help with heating, cooling, maintenance, and system replacement. Share the system type, symptoms, and model if known. Ask whether diagnosis, parts, permits, and installation are included.",
    commonJobs: [
      "Air conditioning repair",
      "Heating system maintenance",
      "Heat pump and furnace replacement",
    ],
    projectTips: [
      "Share the system type, symptoms, and model if known. Ask whether diagnosis, parts, permits, and installation are included.",
      "Confirm the scope, price, and expected timing before agreeing to the work.",
    ],
    faqs: [
      {
        question: "What should I include in my request?",
        answer:
          "Share the system type, symptoms, and model if known. Ask whether diagnosis, parts, permits, and installation are included.",
      },
      {
        question: "Does posting a project book a service?",
        answer:
          "No. Posting lets you discuss your project with matching professionals. Availability varies by location. Agree on the work and timing before booking.",
      },
    ],
  },
  Roofing: {
    title: "Roofing Services",
    description:
      "Discuss roof repairs, inspections, and replacement with local professionals. Share your New Jersey project and compare estimates on Aplime.",
    introduction:
      "Discuss roof repairs, inspections, and replacement with local professionals. Include the roof type, building height, and visible damage. Take photos from a safe location and ask about materials and cleanup.",
    commonJobs: [
      "Roof leak assessment",
      "Shingle and flashing repair",
      "Roof replacement",
    ],
    projectTips: [
      "Include the roof type, building height, and visible damage. Take photos from a safe location and ask about materials and cleanup.",
      "Confirm the scope, price, and expected timing before agreeing to the work.",
    ],
    faqs: [
      {
        question: "What should I include in my request?",
        answer:
          "Include the roof type, building height, and visible damage. Take photos from a safe location and ask about materials and cleanup.",
      },
      {
        question: "Does posting a project book a service?",
        answer:
          "No. Posting lets you discuss your project with matching professionals. Availability varies by location. Agree on the work and timing before booking.",
      },
    ],
  },
  "Tree Services": {
    title: "Tree Care and Removal",
    description:
      "Plan tree trimming, removal, stump work, and tree health assessments. Share your New Jersey project and compare estimates on Aplime.",
    introduction:
      "Plan tree trimming, removal, stump work, and tree health assessments. Describe the number and size of trees, nearby structures, and access. Mention power lines and ask about debris removal.",
    commonJobs: ["Tree trimming and pruning", "Tree removal", "Stump removal"],
    projectTips: [
      "Describe the number and size of trees, nearby structures, and access. Mention power lines and ask about debris removal.",
      "Confirm the scope, price, and expected timing before agreeing to the work.",
    ],
    faqs: [
      {
        question: "What should I include in my request?",
        answer:
          "Describe the number and size of trees, nearby structures, and access. Mention power lines and ask about debris removal.",
      },
      {
        question: "Does posting a project book a service?",
        answer:
          "No. Posting lets you discuss your project with matching professionals. Availability varies by location. Agree on the work and timing before booking.",
      },
    ],
  },
  "Appliance Repair": {
    title: "Home Appliance Repair",
    description:
      "Get help diagnosing and repairing everyday household appliances. Share your New Jersey project and compare estimates on Aplime.",
    introduction:
      "Get help diagnosing and repairing everyday household appliances. Share the appliance brand, model, symptoms, and any error codes. Ask about diagnostic fees, parts, and repair warranties.",
    commonJobs: [
      "Refrigerator and dishwasher repair",
      "Washer and dryer repair",
      "Oven and range repair",
    ],
    projectTips: [
      "Share the appliance brand, model, symptoms, and any error codes. Ask about diagnostic fees, parts, and repair warranties.",
      "Confirm the scope, price, and expected timing before agreeing to the work.",
    ],
    faqs: [
      {
        question: "What should I include in my request?",
        answer:
          "Share the appliance brand, model, symptoms, and any error codes. Ask about diagnostic fees, parts, and repair warranties.",
      },
      {
        question: "Does posting a project book a service?",
        answer:
          "No. Posting lets you discuss your project with matching professionals. Availability varies by location. Agree on the work and timing before booking.",
      },
    ],
  },
  "Pest Control": {
    title: "Pest Control Services",
    description:
      "Discuss pest inspections, treatment, and prevention for your property. Share your New Jersey project and compare estimates on Aplime.",
    introduction:
      "Discuss pest inspections, treatment, and prevention for your property. Describe where and when you noticed activity. Mention pets and children, and ask about preparation and follow-up visits.",
    commonJobs: [
      "Pest inspection",
      "Targeted pest treatment",
      "Recurring prevention",
    ],
    projectTips: [
      "Describe where and when you noticed activity. Mention pets and children, and ask about preparation and follow-up visits.",
      "Confirm the scope, price, and expected timing before agreeing to the work.",
    ],
    faqs: [
      {
        question: "What should I include in my request?",
        answer:
          "Describe where and when you noticed activity. Mention pets and children, and ask about preparation and follow-up visits.",
      },
      {
        question: "Does posting a project book a service?",
        answer:
          "No. Posting lets you discuss your project with matching professionals. Availability varies by location. Agree on the work and timing before booking.",
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
  "/faq": {
    title: "Frequently Asked Questions",
    description:
      "Answers about requesting estimates, payments, professional verification, calls, privacy, and account deletion on Aplime.",
    heading: "Answers to common questions about Aplime.",
  },
  "/contact": {
    title: "Contact Aplime",
    description:
      "Reach Aplime support about a project, a professional profile, billing, or your account. Signed-in users can message support from Help.",
    heading: "Get help from the Aplime team.",
  },
} as const;

export const generalFaqs: {
  heading: string;
  items: { question: string; answer: string }[];
}[] = [
  {
    heading: "Using Aplime",
    items: [
      {
        question: "What is Aplime?",
        answer:
          "Aplime is a marketplace for home services. Customers describe a project, professionals discuss it and send written estimates, and messages, calls, scheduling, and project updates stay in one place.",
      },
      {
        question: "Where does Aplime currently operate?",
        answer:
          "New project addresses must currently be in New Jersey. Aplime will say so when you choose an address outside that area.",
      },
      {
        question: "How do I get estimates for my project?",
        answer:
          "Create a request, answer the service questions, and add up to five photos. Eligible professionals can start a private conversation about the project and send itemized written estimates, and you choose which one to accept.",
      },
      {
        question: "Does Aplime handle payment for the work?",
        answer:
          "No. Customers and professionals arrange payment for the work directly. Aplime does not process project payments. Professionals pay Aplime a membership through Stripe.",
      },
      {
        question: "Can I talk to a professional before choosing?",
        answer:
          "Yes. You can use private project messages and schedule audio or video calls. Aplime does not record audio or video calls in this application.",
      },
    ],
  },
  {
    heading: "Trust and safety",
    items: [
      {
        question: "How are professionals checked?",
        answer:
          "Stripe Identity verifies the account holder, and Aplime administrators review a business profile before it is published. This does not prove licensing, insurance, qualifications, or quality of work, so confirm those directly with the business and the issuing authority.",
      },
      {
        question: "What should I do if something goes wrong on a project?",
        answer:
          "Use Report an issue on the project while work is under way, paused, or finished. Reporting alerts Aplime administrators. You can also message support from Help in your account.",
      },
      {
        question: "Is Aplime an emergency service?",
        answer:
          "No. For fire, flooding, gas, live wiring, or any immediate danger, contact emergency services or the appropriate utility first.",
      },
    ],
  },
  {
    heading: "Your account and privacy",
    items: [
      {
        question: "Who can see my project messages and files?",
        answer:
          "Project conversations are between the accounts involved, and files are stored privately. Authorized Aplime administrators can review account details, projects, conversations, and uploaded files for support, marketplace operations, and safety, and that access is logged.",
      },
      {
        question: "How do I download my data or delete my account?",
        answer:
          "Open Settings in your account to download a copy of your data or permanently delete the account. Deletion is not available while you have booked, in-progress, paused, or disputed work.",
      },
    ],
  },
];

export const seoStaticPaths = [
  "/services",
  ...Object.keys(informationalPages),
] as string[];
