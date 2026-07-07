import axe from "axe-core";
import { expect } from "vitest";

// Run axe over a container and assert no violations. color-contrast is disabled
// because jsdom does not compute layout/color; contrast is verified by design
// (P6 token choices) and can be re-checked in a real browser.
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const summary = results.violations
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)
    .join("\n");
  expect(results.violations, summary).toHaveLength(0);
}
