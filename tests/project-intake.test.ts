import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  categories,
  questionsFor,
} from "../src/shared/service-questionnaires.js";
import { projectSchema } from "../src/shared/domain.js";
import {
  initialIntake,
  intakeBudgetChoice,
  intakeQuestions,
  intakeSteps,
  projectPayload,
  stepProblem,
  firstInvalidStep,
  parseIntakeSession,
  INTAKE_TTL,
} from "../src/client/project-intake-state.js";
function complete(category: (typeof categories)[number]) {
  const draft = initialIntake({
    category,
    zip: "08859",
    zipLabel: "Parlin, NJ 08859, USA",
    addressZip: "08859",
    address: "1 Test Street, Parlin, NJ 08859",
    placeId: "test-place",
    urgency: "flexible",
    contactPhone: "(201) 555-0123",
    contactConsent: true,
  });
  for (const q of intakeQuestions(category))
    draft.intake[q.id] =
      q.options?.find((v) => v !== "Other") || "A sufficiently detailed answer";
  return draft;
}
test("each service has a ZIP-first questionnaire with valid server payload and no duplicate property question", () => {
  for (const category of categories) {
    const draft = complete(category);
    assert.deepEqual(intakeSteps(draft).slice(0, 2), ["zip", "category"]);
    assert.equal(
      intakeQuestions(category).filter((q) => q.id === "propertyType").length,
      1,
    );
    assert.equal(firstInvalidStep(draft), null, category);
    assert.equal(
      projectSchema.safeParse(projectPayload(draft)).success,
      true,
      category,
    );
    assert.deepEqual(
      Object.keys(projectPayload(draft).intake),
      questionsFor(category).map((q) => q.id),
    );
  }
});
test("Other answers need details and are accepted without allowing unknown question keys", () => {
  const draft = complete("Cleaning");
  draft.intake.cleaningType = "Other: ";
  assert.match(stepProblem("question:cleaningType", draft), /more/);
  assert.equal(projectSchema.safeParse(projectPayload(draft)).success, false);
  draft.intake.cleaningType = "Other: Clean the greenhouse windows";
  assert.equal(firstInvalidStep(draft), null);
  const payload = projectPayload(draft);
  assert.equal(
    projectSchema.safeParse({
      ...payload,
      intake: { ...payload.intake, untrusted: "Injected question" },
    }).success,
    false,
  );
  draft.intake.cleaningType = "Unlisted answer";
  assert.equal(projectSchema.safeParse(projectPayload(draft)).success, false);
});
test("review requires verified ZIP, matching address ZIP, timing and sensible budget", () => {
  const draft = complete("Painting");
  draft.zipLabel = "";
  assert.equal(firstInvalidStep(draft), "zip");
  draft.zipLabel = "Parlin, NJ";
  draft.addressZip = "07001";
  assert.equal(firstInvalidStep(draft), "address");
  draft.addressZip = "08859";
  draft.urgency = "";
  assert.equal(firstInvalidStep(draft), "timing");
  draft.urgency = "flexible";
  draft.budgetMin = 20000;
  draft.budgetMax = 10000;
  assert.equal(firstInvalidStep(draft), "budget");
  draft.budgetMin = null;
  draft.description = "Too short";
  assert.equal(firstInvalidStep(draft), "notes");
});
test("restored guest details survive sign-in but account-owned drafts never cross users and expire", () => {
  const now = Date.now();
  const session = {
    version: 1,
    updatedAt: now,
    owner: null,
    draft: complete("Cleaning"),
    step: "review",
    photoKey: randomUUID(),
    clientKey: randomUUID(),
  };
  const raw = JSON.stringify(session);
  assert.equal(parseIntakeSession(raw, null, now)?.step, "review");
  assert.equal(
    parseIntakeSession(raw, "new-customer", now)?.draft.zip,
    "08859",
  );
  const owned = JSON.stringify({ ...session, owner: "customer-one" });
  assert.equal(parseIntakeSession(owned, null, now), null);
  assert.equal(parseIntakeSession(owned, "customer-two", now), null);
  assert.ok(parseIntakeSession(owned, "customer-one", now));
  assert.equal(parseIntakeSession(raw, null, now + INTAKE_TTL + 1), null);
  assert.equal(parseIntakeSession("{broken", null, now), null);
  assert.equal(
    parseIntakeSession(JSON.stringify({ ...session, version: 0 }), null, now),
    null,
  );
});
test("category changes drop previous answers and generated descriptions stay within server bounds", () => {
  const draft = complete("Handyman");
  for (const q of intakeQuestions("Handyman"))
    draft.intake[q.id] = "Other: " + "a".repeat(1400);
  assert.equal(projectSchema.safeParse(projectPayload(draft)).success, true);
  assert.equal(projectPayload(draft).description.length, 4000);
  const changed = { ...draft, category: "Cleaning" as const, intake: {} };
  assert.equal(firstInvalidStep(changed), "question:cleaningType");
});

test("restored custom budgets remain editable even with one bound or a preset maximum", () => {
  assert.equal(
    intakeBudgetChoice({ budgetMin: 20000, budgetMax: null }),
    "Set my own budget",
  );
  assert.equal(
    intakeBudgetChoice({ budgetMin: 20000, budgetMax: 50000 }),
    "Set my own budget",
  );
  assert.equal(
    intakeBudgetChoice({ budgetMin: 50000, budgetMax: 200000 }),
    "$500–$2,000",
  );
  assert.equal(
    intakeBudgetChoice({ budgetMin: null, budgetMax: null }),
    "I’d like advice / Not sure",
  );
});

test("publishing requires a valid phone and explicit consent", () => {
  const draft = complete("Cleaning");
  draft.contactConsent = false;
  assert.equal(firstInvalidStep(draft), "contact");
  draft.contactConsent = true;
  draft.contactPhone = "123";
  assert.equal(firstInvalidStep(draft), "contact");
  draft.contactPhone = "2015550123";
  assert.equal(firstInvalidStep(draft), null);
});
