import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.js";
import { SessionProvider } from "../auth/SessionContext.js";

const SESSION = {
  userId: "u1", name: "Sam Carter", role: "SCHOOL_ADMIN",
  schools: [{ schoolId: "s1", schoolName: "Lincoln Elementary", districtId: "d1", districtName: "Springfield USD" }],
};

// Two grade-1 rows: one clean, one with ORF out of range (error).
const DIRTY_CSV =
  "Student ID,First Name,Last Name,School,Grade,LNF,PSF,NWF-CLS,NWF-WRC,WRF,ORF,ORF-Accuracy,MAZE\n" +
  "1001,Ada,Lovelace,Lincoln Elementary,1,40,35,30,12,25,50,95,\n" +
  "1002,Grace,Hopper,Lincoln Elementary,1,40,35,30,12,25,999,95,\n";

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/session") && method === "GET") return new Response(JSON.stringify(SESSION), { status: 200 });
    if (url.endsWith("/api/uploads") && method === "POST") {
      return new Response(JSON.stringify({ uploadId: "up-1", detection: { detected: "DIBELS_8", confidence: 1, ambiguous: false, scores: {}, ranked: [] }, duplicate: null }), { status: 201 });
    }
    return new Response("{}", { status: 200 });
  });
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

async function goToValidateStage() {
  render(
    <SessionProvider>
      <App />
    </SessionProvider>,
  );
  await screen.findByRole("heading", { name: /upload a file/i });
  await userEvent.selectOptions(screen.getByLabelText("Benchmark period"), "MOY");
  await userEvent.upload(fileInput(), new File([DIRTY_CSV], "dirty.csv", { type: "text/csv" }));
  await userEvent.click(await screen.findByRole("button", { name: /Continue to mapping/i }));
  await userEvent.click(await screen.findByRole("button", { name: /Continue to validation/i }));
  await screen.findByRole("region", { name: /validation results/i });
}

function summaryCard(label: string): HTMLElement {
  // The label sits inside the card div alongside the value.
  return screen.getByText(label).parentElement as HTMLElement;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => vi.unstubAllGlobals());

describe("US3: validate and fix inline", () => {
  it("shows error/warning/clean summary cards, with the warning card always yellow at zero", async () => {
    await goToValidateStage();
    const region = screen.getByRole("region", { name: /validation results/i });
    expect(within(summaryCard("Errors")).getByText("1")).toBeInTheDocument();
    expect(within(summaryCard("Clean")).getByText("1")).toBeInTheDocument();
    const warnings = summaryCard("Warnings");
    expect(within(warnings).getByText("0")).toBeInTheDocument();
    expect(warnings.className).toMatch(/border-yellow/);
    expect(region).toBeInTheDocument();
  });

  it("re-validates a fixed cell inline and drops the error count", async () => {
    await goToValidateStage();
    expect(within(summaryCard("Errors")).getByText("1")).toBeInTheDocument();

    const cell = screen.getByRole("button", { name: /Row 2, ORF: 999/ });
    await userEvent.click(cell);
    const input = screen.getByRole("textbox", { name: /Edit Row 2, ORF/ });
    await userEvent.clear(input);
    await userEvent.type(input, "300{Enter}");

    expect(within(summaryCard("Errors")).getByText("0")).toBeInTheDocument();
  });

  it("filters to rows with issues", async () => {
    await goToValidateStage();
    // Both rows visible initially (student ids present as editable cells).
    expect(screen.getByRole("button", { name: /Row 1, Student ID: 1001/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Rows with Issues/i }));
    expect(screen.queryByRole("button", { name: /Row 1, Student ID: 1001/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Row 2, Student ID: 1002/ })).toBeInTheDocument();
  });

  it("offers a validation report download when issues exist", async () => {
    await goToValidateStage();
    const btn = screen.getByRole("button", { name: /Download validation report/i });
    expect(btn).toBeEnabled();
  });
});
