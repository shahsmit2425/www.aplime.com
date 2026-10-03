import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedTransition,
  signupSchema,
  profileSchema,
  actionSchema,
  projectSchema,
  isMember,
  assertFuture,
} from "../src/shared/domain.js";
test("project transitions are restricted to the correct participant and lifecycle stage", () => {
  const project = {
    customerId: "customer-owner",
    proId: "professional-owner",
    status: "booked" as const,
  };
  assert.equal(
    allowedTransition(
      project,
      { id: "professional-owner", role: "pro" },
      "start",
    ),
    true,
  );
  for (const role of ["customer", "pro", "admin"] as const)
    assert.equal(
      allowedTransition(project, { id: "stranger", role }, "start"),
      false,
    );
  assert.equal(
    allowedTransition(
      project,
      { id: "customer-owner", role: "customer" },
      "complete",
    ),
    false,
  );
  assert.equal(
    allowedTransition(
      { ...project, status: "in_progress" },
      { id: "professional-owner", role: "pro" },
      "complete",
    ),
    true,
  );
  assert.equal(
    allowedTransition(
      { ...project, status: "completed" },
      { id: "professional-owner", role: "pro" },
      "complete",
    ),
    false,
  );
  assert.equal(
    allowedTransition(
      { ...project, status: "disputed" },
      { id: "customer-owner", role: "customer" },
      "accept",
    ),
    false,
  );
});
test("customers cannot promote themselves or verify their own profile", () => {
  assert.equal(
    signupSchema.safeParse({ name: "Account owner", role: "admin" }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({
      business: "Business",
      category: "Handyman",
      bio: "A detailed business description.",
      zip: "10001",
      rate: 25,
      available: true,
      availability: [],
      verified: true,
    }).success,
    false,
  );
});
test("financial amounts use bounded integer cents and unknown fields are rejected", () => {
  assert.equal(
    actionSchema.safeParse({
      type: "quote",
      laborAmount: 12500,
      materialsAmount: 2500,
      description: "Detailed scope of work",
      exclusions: "Permit fees",
      timeline: "One workday",
      expiresAt: null,
    }).success,
    true,
  );
  assert.equal(
    actionSchema.safeParse({
      type: "quote",
      laborAmount: 50,
      materialsAmount: 0,
      description: "Detailed scope of work",
      exclusions: "",
      timeline: "One workday",
      expiresAt: null,
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      type: "quote",
      laborAmount: -100,
      materialsAmount: 0,
      description: "Detailed scope of work",
      exclusions: "",
      timeline: "One workday",
      expiresAt: null,
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      type: "accept",
      quoteId: crypto.randomUUID(),
      amount: 1,
    }).success,
    false,
  );
});
test("project submissions reject forged identity and invalid dates", () => {
  assert.equal(
    projectSchema.safeParse({
      title: "Project title",
      description: "A sufficiently detailed scope.",
      category: "Handyman",
      zip: "10001",
      customerId: "forged",
    }).success,
    false,
  );
  assert.throws(() => assertFuture("2020-01-01T12:00:00Z"));
  assert.throws(() => assertFuture("not-a-date"));
  assert.doesNotThrow(() => assertFuture(null));
});
test("administrator status does not grant private conversation membership", () => {
  assert.equal(
    isMember({ customerId: "a", proId: "b" }, { id: "c", role: "admin" }),
    false,
  );
});
