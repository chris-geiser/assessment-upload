import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SampleFilePicker } from "./SampleFilePicker.js";
import { SAMPLES } from "../../demo/samples.js";

describe("SampleFilePicker", () => {
  it("bundles the fixture samples", () => {
    // Confirms the ?raw glob resolved the real fixtures at build time.
    expect(SAMPLES.length).toBeGreaterThanOrEqual(4);
    expect(SAMPLES.every((s) => s.content.includes("\n"))).toBe(true);
  });

  it("loads a chosen sample as a CSV File", async () => {
    const onLoad = vi.fn();
    render(<SampleFilePicker onLoad={onLoad} />);
    await userEvent.selectOptions(screen.getByLabelText("Or load a sample file"), "dibels-dirty");

    expect(onLoad).toHaveBeenCalledTimes(1);
    const file = onLoad.mock.calls[0][0] as File;
    expect(file.name).toBe("dibels-dirty.csv");
    expect(file.type).toBe("text/csv");
    expect(file.size).toBeGreaterThan(0);
    // Content fidelity is asserted against the bundled sample (jsdom File lacks text()).
    expect(SAMPLES.find((s) => s.id === "dibels-dirty")!.content).toContain("Student ID");
  });
});
