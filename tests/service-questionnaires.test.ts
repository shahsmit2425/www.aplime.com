import test from "node:test";
import assert from "node:assert/strict";
import { categories, projectSchema } from "../src/shared/domain.js";
import { questionsFor } from "../src/shared/service-questionnaires.js";

const baseProject = {
  title: "Repair work at home",
  description: "The project needs professional assessment and repair work.",
  address: "350 Fifth Avenue, New York, NY 10118",
  placeId: "test-place",
  proId: null,
  scheduledAt: null,
  urgency: "flexible",
  propertyType: "home",
  budgetMin: null,
  budgetMax: null,
};

test("every service questionnaire produces a valid complete project intake", () => {
  for (const category of categories) {
    const intake = Object.fromEntries(
      questionsFor(category).map((question) => [
        question.id,
        question.options?.[0] || "Detailed answer",
      ]),
    );
    assert.equal(
      projectSchema.safeParse({ ...baseProject, category, intake }).success,
      true,
      category,
    );
  }
});

test("project intake rejects missing and unexpected questionnaire answers", () => {
  assert.equal(
    projectSchema.safeParse({
      ...baseProject,
      category: "Plumbing",
      intake: {},
    }).success,
    false,
  );
  const valid = Object.fromEntries(
    questionsFor("Cleaning").map((question) => [
      question.id,
      question.options?.[0] || "Detailed answer",
    ]),
  );
  assert.equal(
    projectSchema.safeParse({
      ...baseProject,
      category: "Cleaning",
      intake: { ...valid, hiddenField: "unexpected" },
    }).success,
    false,
  );
});
