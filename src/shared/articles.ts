export type HomeGuide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  service: string;
  takeaway: string;
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    checklist?: string[];
  }[];
  sources: { title: string; url: string }[];
};

export const guideDate = "2026-10-25";
export const homeGuides: HomeGuide[] = [
  {
    slug: "compare-home-service-estimates-new-jersey",
    title: "How to compare home-service estimates in New Jersey",
    description:
      "Compare scope, materials, timing, exclusions, and payment terms before choosing a home-service professional for your New Jersey project.",
    category: "Planning & estimates",
    service: "Handyman",
    takeaway:
      "Give every professional the same project brief. A lower total is only useful when you know what it includes.",
    sections: [
      {
        id: "same-brief",
        title: "Start with one clear project brief",
        paragraphs: [
          "Two estimates can look very different because the professionals are pricing different work. Before asking for a price, write down the result you want, the rooms or items involved, and anything that must stay untouched. Include your town and ZIP code, photos, and preferred timing.",
          "Separate essentials from optional improvements. For a room refresh, painting the walls might be essential while painting the ceiling is optional. Ask each professional to price the same essentials and identify optional work separately. This makes the decision easier than comparing a collection of differently sized projects.",
        ],
        checklist: [
          "List the work and the areas included.",
          "Describe access: stairs, parking, elevator reservations, or building rules.",
          "Say who will supply materials and remove waste.",
          "Mention your deadline and whether it can move.",
        ],
      },
      {
        id: "compare",
        title: "Compare the promises behind the price",
        paragraphs: [
          "Put each estimate beside your project brief. Check whether preparation, labor, materials, cleanup, and disposal are included. Ask what could change the amount and whether the price is an estimate or a fixed quote for the stated scope.",
          "Compare start availability separately from the number of working days. A professional may need only two days on site but may not be available for several weeks. Also ask whether materials, inspections, or drying time could extend the calendar schedule.",
        ],
        checklist: [
          "Scope: are the same tasks included?",
          "Materials: are the product and quality level specified?",
          "Exclusions: what will cost extra?",
          "Timing: when can work start and what can delay it?",
          "Payment: what is due, when, and for which milestone?",
        ],
      },
      {
        id: "assessment",
        title: "When an assessment comes before a price",
        paragraphs: [
          "Photos cannot reveal every condition. If a professional needs an assessment, ask what they need to inspect and whether that assessment carries a fee before arranging it. A free estimate should not be assumed to include a free diagnostic visit.",
          "For example, a homeowner requesting a wall repair can share dimensions and photos, but the professional may still need to inspect the underlying damage. Ask for the assessment result and revised scope in writing before approving the repair. Do not treat an unpriced assessment request as a final estimate.",
        ],
      },
      {
        id: "choose",
        title: "Choose with the details in writing",
        paragraphs: [
          "Read the business profile and relevant customer feedback, then ask about similar completed work. Verify any registration, trade license, and insurance relevant to the job with the appropriate issuer. Identity verification alone does not establish those credentials.",
          "New Jersey Consumer Affairs provides contractor-hiring guidance and registration resources. Consult those resources and your municipal building department when checking requirements for your particular work. On Aplime, keep questions and estimate changes in the project conversation. Service payments are arranged directly with the professional.",
        ],
      },
    ],
    sources: [
      {
        title:
          "New Jersey Consumer Affairs: Home Improvement Contractor Business resources",
        url: "https://www.njconsumeraffairs.gov/HIC/",
      },
    ],
  },
  {
    slug: "standard-vs-deep-cleaning-project-checklist",
    title:
      "Standard or deep cleaning? Write a request that gets the right estimate",
    description:
      "Decide what your cleaning project includes, describe your home clearly, and prepare a practical room-by-room checklist before requesting estimates.",
    category: "Cleaning",
    service: "Cleaning",
    takeaway:
      "Cleaning package names vary. Agree on the actual tasks, especially appliance interiors, cabinets, windows, and heavy buildup.",
    sections: [
      {
        id: "choose-scope",
        title: "Choose the work before the package name",
        paragraphs: [
          "A standard clean generally describes routine upkeep, while a deep clean often involves more detailed work. Those labels are not a universal checklist. One business may include baseboards in its routine service while another treats them as an extra. Ask for a task list rather than relying on the package name.",
          "Walk through your home and decide what would make the visit successful. If the priority is a kitchen reset, say which surfaces and appliances need attention. If you need recurring cleaning, describe both the first visit and the maintenance visits you want afterward.",
        ],
      },
      {
        id: "room-list",
        title: "Build a room-by-room request",
        paragraphs: [
          "Provide the approximate size of the space, the rooms to be cleaned, and whether it will be occupied or empty. Mention pets, access arrangements, and any surfaces that need a particular product or method. You can discuss entry instructions privately once you select a professional.",
          "For each room, distinguish accessible surfaces from interiors or difficult-to-reach areas. A request for kitchen cleaning does not automatically include inside the oven or refrigerator. Ask how the business handles fragile items and whether you should move them first.",
        ],
        checklist: [
          "Kitchen: counters, sink, cabinet fronts, and any appliance interiors.",
          "Bathrooms: fixtures, shower, tub, and areas with visible buildup.",
          "Living spaces: floors, reachable dusting, and specific furniture surfaces.",
          "Extras: interior windows, baseboards, laundry, or inside cabinets.",
        ],
      },
      {
        id: "price-factors",
        title: "Explain the conditions that affect the estimate",
        paragraphs: [
          "Room count alone rarely describes the whole job. Clutter, buildup, access, requested extras, and the condition of the home all affect the work involved. A few clear photos help a professional decide whether they can quote remotely or need more information.",
          "Ask whether the estimate is for the whole job or for time on site. If it is hourly, ask how many cleaners are included and what happens if the work takes longer than expected. Confirm whether supplies, equipment, and any parking charges are included.",
        ],
      },
      {
        id: "prepare",
        title: "Prepare for the visit and review the result",
        paragraphs: [
          "Agree on your top priorities before the appointment. If time is limited, explain which rooms should come first. Clear personal items from surfaces you want cleaned and make a plan for pets without assuming the cleaning team will supervise them.",
          "After the work, compare the result with the agreed checklist. Raise a specific concern promptly and ask how the business handles missed tasks. For recurring service, use that first visit to adjust the scope so both sides understand the next appointment.",
        ],
      },
    ],
    sources: [],
  },
  {
    slug: "junk-removal-preparation-new-jersey",
    title: "Plan a junk removal pickup without last-minute surprises",
    description:
      "Prepare an item list, describe access, confirm disposal exclusions, and compare junk removal estimates for your New Jersey home.",
    category: "Junk removal",
    service: "Junk Removal",
    takeaway:
      "Photograph the entire load and describe where it is located. Confirm accepted items and any extra handling charges before pickup.",
    sections: [
      {
        id: "inventory",
        title: "Make an inventory before requesting a pickup",
        paragraphs: [
          "Start with a list of everything you want removed. A sofa, a refrigerator, boxes, and renovation debris can require different handling. Include approximate dimensions of large pieces and photos that show the full amount, rather than only a close-up of one item.",
          "Sort the list into items to keep, donate, recycle, and remove. If you want donation or recycling, ask what the provider can actually arrange. Do not assume every collected item will be donated, or that an organization will accept furniture in any condition.",
        ],
        checklist: [
          "Count large items and describe their approximate size.",
          "Identify appliances, electronics, and building debris separately.",
          "Photograph the complete load from more than one angle.",
          "Label anything that must stay.",
        ],
      },
      {
        id: "access",
        title: "Explain the route from the items to the truck",
        paragraphs: [
          "Tell the professional whether the items are at the curb, in a garage, upstairs, or in a basement. Mention narrow stairs, elevators, a long carry, parking restrictions, or building pickup rules. Share whether a large item needs disassembly before it can fit through a doorway.",
          "Confirm who will move the items and whether labor is included. Curbside pickup and removal from inside a home are different tasks. If a building requires an elevator reservation, arrange it before agreeing to an arrival window.",
        ],
      },
      {
        id: "excluded-items",
        title: "Keep special waste out of the ordinary load",
        paragraphs: [
          "Ask about excluded materials before booking. Paints, chemicals, batteries, and other special waste may need a separate collection route. New Jersey collection arrangements vary by locality: Monmouth County, for example, publishes its own household hazardous waste facility procedures. Check your own county or municipality for accepted materials and appointments.",
          "Keep containers identifiable and tell the provider what you have; do not hide unknown materials in bags or mix substances together. If you are unsure what something is, describe it to the appropriate local disposal program before arranging transport.",
        ],
      },
      {
        id: "confirm-price",
        title: "Confirm how the final price is decided",
        paragraphs: [
          "Ask whether the estimate is based on volume, individual items, weight, labor, or a combination. Clarify any charges for stairs, heavy items, disposal, or a second trip. Request an updated amount if your item list changes.",
          "Before loading begins, walk through the agreed items with the crew and confirm the price and scope. Keep a copy of the estimate and receipt. A clear inventory protects the items you intend to keep and makes the service easier to compare.",
        ],
      },
    ],
    sources: [
      {
        title:
          "Monmouth County: Household Hazardous Waste Facility (local example)",
        url: "https://www.co.monmouth.nj.us/page.aspx?ID=4371",
      },
    ],
  },
  {
    slug: "prepare-hvac-service-visit",
    title: "What to prepare before an HVAC service visit",
    description:
      "Describe heating or cooling problems clearly, gather equipment information, and know what to ask when comparing maintenance or repair estimates.",
    category: "Heating & cooling",
    service: "HVAC",
    takeaway:
      "Describe the symptom and when it occurs. Ask separately about the diagnostic visit, proposed repair, and any replacement recommendation.",
    sections: [
      {
        id: "describe-symptoms",
        title: "Describe what you notice, not a guessed diagnosis",
        paragraphs: [
          "A useful service request starts with observations: which rooms are affected, whether the issue is constant, and when it began. Note unusual sounds or changes in performance without taking equipment apart. If the thermostat displays a message, share a photo of that display.",
          "Tell the professional whether you need routine maintenance or help with a specific problem. These are different appointments. An urgent breakdown should be described clearly rather than booked as a routine tune-up. A marketplace message is not an emergency response channel.",
        ],
      },
      {
        id: "equipment",
        title: "Gather the information you can safely access",
        paragraphs: [
          "Have the equipment make, model, and approximate age available if you know them. A photo of an accessible label is useful; do not remove covers or enter unsafe areas to obtain it. Gather past service records and warranty information if available.",
          "Describe where the equipment is located and any access constraints. Before the visit, clear a safe route and ask the business what space it needs. Keep children and pets away from the work area.",
        ],
        checklist: [
          "Equipment type and accessible model information.",
          "Affected rooms and the time the problem occurs.",
          "Recent service history and any warranty documents.",
          "Photos of accessible equipment and thermostat messages.",
        ],
      },
      {
        id: "maintenance",
        title: "Ask what the maintenance appointment includes",
        paragraphs: [
          "ENERGY STAR recommends regular professional maintenance and provides a checklist covering controls, connections, drains, and system-specific components. Use that checklist as a conversation starter with the technician, not as instructions to perform technical work yourself.",
          "Ask for the service scope in writing and how findings will be reported. Follow the equipment manufacturer's instructions for any homeowner maintenance, including filter selection and replacement. Ask the technician if you are unsure what is appropriate for your system.",
        ],
      },
      {
        id: "repair-options",
        title: "Separate diagnosis from the repair decision",
        paragraphs: [
          "Before booking, confirm any diagnostic fee and whether it is credited toward an approved repair. After assessment, ask the professional to explain the problem, proposed work, parts, expected timing, and warranty. Request approval before extra work begins.",
          "If replacement is suggested, ask why repair is unsuitable and what alternatives exist. Compare written scopes rather than only equipment names or headline prices. Verify the credentials relevant to the work and ask whether permits or other local approvals need to be addressed.",
        ],
      },
    ],
    sources: [
      {
        title: "ENERGY STAR: Heating and cooling maintenance checklist",
        url: "https://www.energystar.gov/saveathome/heating-cooling/maintenance-checklist",
      },
    ],
  },
  {
    slug: "interior-painting-estimate-checklist",
    title: "What to include in an interior painting estimate",
    description:
      "Plan an interior painting project with a clear checklist for surfaces, preparation, paint, room access, cleanup, and the final walkthrough.",
    category: "Painting",
    service: "Painting",
    takeaway:
      "Preparation and included surfaces matter as much as paint color. Ask for walls, ceilings, trim, and repairs to be identified separately.",
    sections: [
      {
        id: "surfaces",
        title: "Name every surface you want painted",
        paragraphs: [
          "A request to paint a bedroom can mean walls only, or walls, ceiling, doors, trim, and a closet. List the surfaces explicitly. Include approximate room dimensions and photos of the space so professionals can ask useful follow-up questions.",
          "Mention high ceilings, stairwells, built-ins, and furniture that may limit access. If you are deciding between a small refresh and a larger project, ask for the optional rooms or surfaces to be listed separately instead of combining everything into one unclear amount.",
        ],
      },
      {
        id: "preparation",
        title: "Make preparation part of the written scope",
        paragraphs: [
          "Ask which holes, cracks, or damaged areas the estimate includes and how the surfaces will be prepared. Photograph visible damage rather than describing every wall as being in good condition. Ask whether unresolved moisture or another underlying issue needs assessment before painting.",
          "If old coatings could require special handling, ask a qualified professional how they will assess and manage them before disturbance. Do not begin scraping unknown coatings just to prepare for a quote. For local requirements or permit questions, contact your municipal building department.",
        ],
        checklist: [
          "Surface cleaning and preparation.",
          "Repairs included and repairs excluded.",
          "Protection for floors, furniture, and adjacent areas.",
          "Primer, paint products, finish, and planned coverage.",
          "Cleanup and handling of leftover materials.",
        ],
      },
      {
        id: "products",
        title: "Confirm materials and access",
        paragraphs: [
          "Agree on who buys the paint and when colors must be selected. Ask the professional to identify the product and finish rather than simply promising premium paint. Discuss whether a sample area is needed and how a color change after work starts will be handled.",
          "Ask how many rooms can be used while the work is underway and what access the crew needs each day. Follow product and professional guidance about ventilation, drying, and reoccupying the space. Calendar duration can differ from the number of days spent actively painting.",
        ],
      },
      {
        id: "walkthrough",
        title: "Plan the final walkthrough before work begins",
        paragraphs: [
          "Ask how touch-ups will be identified and resolved. At the final walkthrough, compare the completed surfaces with the agreed scope and record specific concerns in writing. Confirm what leftover paint or product information you will receive for future maintenance.",
          "For New Jersey home improvement work, use Consumer Affairs resources to help check the business and understand hiring considerations. A profile badge is not a substitute for verifying the credentials relevant to your job. Keep the agreed scope and any approved changes together with the estimate.",
        ],
      },
    ],
    sources: [
      {
        title: "New Jersey Consumer Affairs: Contractor hiring resources",
        url: "https://www.njconsumeraffairs.gov/HIC/",
      },
    ],
  },
];
export const guidePath = (guide: HomeGuide) => "/blog/" + guide.slug;
export const findGuide = (path: string) =>
  homeGuides.find((guide) => guidePath(guide) === path);
export function guideReadMinutes(guide: HomeGuide) {
  const words = [
    guide.takeaway,
    ...guide.sections.flatMap((s) => [
      s.title,
      ...s.paragraphs,
      ...(s.checklist || []),
    ]),
  ]
    .join(" ")
    .split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}
