import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoAxeViolations } from "../test/axe.js";
import { Badge, Btn, Modal, Select, Stepper, SummaryCard, Toast } from "./index.js";

describe("kit accessibility (P6)", () => {
  it("Btn has an accessible name and 44px min target", async () => {
    const { container } = render(<Btn>Submit</Btn>);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn.className).toContain("min-h-[44px]");
    await expectNoAxeViolations(container);
  });

  it("Select is labelled", async () => {
    const { container } = render(
      <Select label="Benchmark period" options={[{ value: "MOY", label: "MOY" }]} />,
    );
    expect(screen.getByLabelText("Benchmark period")).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("Badge, SummaryCard, Stepper, Toast render without axe violations", async () => {
    const { container } = render(
      <div>
        <Badge tone="error">Failed</Badge>
        <SummaryCard label="Errors" value={4} tone="error" />
        <Stepper steps={[{ key: "u", label: "Upload" }, { key: "m", label: "Map" }]} currentIndex={1} />
        <Toast tone="error">Something went wrong</Toast>
      </div>,
    );
    await expectNoAxeViolations(container);
  });

  it("Stepper marks the current step with aria-current", () => {
    render(<Stepper steps={[{ key: "u", label: "Upload" }, { key: "m", label: "Map" }]} currentIndex={0} />);
    const current = screen.getByText("Upload").closest("li");
    expect(current).toHaveAttribute("aria-current", "step");
  });
});

describe("Modal (P6)", () => {
  it("renders as a labelled dialog, closes on Escape, and has a labelled close control", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open title="Replace upload?" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Replace upload?" });
    expect(within(dialog).getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when closed", () => {
    render(<Modal open={false} title="Hidden">x</Modal>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
