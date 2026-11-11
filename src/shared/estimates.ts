import { money, type Quote } from "./domain.js";
export function quotePrice(q: Quote) {
  return q.assessmentRequired || q.amount === null
    ? "Price pending assessment"
    : money(q.amount);
}
export function quoteTiming(q: Quote) {
  return q.assessmentRequired
    ? "Completion estimate after assessment"
    : q.estimatedDays
      ? `${q.estimatedDays} ${q.estimatedDays === 1 ? "day" : "days"} to finish`
      : q.timeline;
}
