import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.js";
import { SessionProvider } from "../auth/SessionContext.js";

const SESSION = {
  userId: "u1", name: "Sam Carter", role: "SCHOOL_ADMIN",
  schools: [{ schoolId: "s1", schoolName: "Lincoln Elementary", districtId: "d1", districtName: "Springfield USD" }],
};

const HEADER = "Student ID,First Name,Last Name,School,Grade,LNF,PSF,NWF-CLS,NWF-WRC,WRF,ORF,ORF-Accuracy,MAZE\n";
const CLEAN_ROW = "1001,Ada,Lovelace,Lincoln Elementary,1,40,35,30,12,25,50,95,\n";
const ERROR_ROW = "1002,Grace,Hopper,Lincoln Elementary,1,40,35,30,12,25,999,95,\n";

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/session") && method === "GET") return new Response(JSON.stringify(SESSION), { status: 200 });
    if (url.endsWith("/api/uploads") && method === "POST")
      return new Response(JSON.stringify({ uploadId: "up-1", detection: { detected: "DIBELS_8", confidence: 1, ambiguous: false, scores: {}, ranked: [] }, duplicate: null }), { status: 201 });
    return new Response("{}", { status: 200 });
  });
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

async function goToValidate(csv: string) {
  render(<SessionProvider><App /></SessionProvider>);
  await screen.findByRole("heading", { name: /upload a file/i });
  await userEvent.selectOptions(screen.getByLabelText("Benchmark period"), "MOY");
  await userEvent.upload(fileInput(), new File([csv], "d.csv", { type: "text/csv" }));
  await userEvent.click(await screen.findByRole("button", { name: /Continue to mapping/i }));
  await userEvent.click(await screen.findByRole("button", { name: /Continue to validation/i }));
  await screen.findByRole("region", { name: /validation results/i });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => vi.unstubAllGlobals());

describe("US4 demo: adaptive submit", () => {
  it("a clean file offers Submit and reaches the success screen", async () => {
    await goToValidate(HEADER + CLEAN_ROW);
    const submit = screen.getByRole("button", { name: /^Submit$/ });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(await screen.findByRole("heading", { name: /1 row submitted successfully/i })).toBeInTheDocument();
  });

  it("a mixed file offers Submit Clean Rows Only, then completes after the error is fixed", async () => {
    await goToValidate(HEADER + CLEAN_ROW + ERROR_ROW);

    // Mixed: one clean, one error → partial submit only.
    const partial = await screen.findByRole("button", { name: /Submit Clean Rows Only \(1\)/ });
    await userEvent.click(partial);

    // The clean row is now submitted; the error row still blocks the rest.
    expect(within(screen.getByText("Submitted").parentElement as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fix errors to submit/ })).toBeDisabled();

    // Fix the error row, then submit the remainder.
    await userEvent.click(screen.getByRole("button", { name: /Row 2, ORF: 999/ }));
    const input = screen.getByRole("textbox", { name: /Edit Row 2, ORF/ });
    await userEvent.clear(input);
    await userEvent.type(input, "300{Enter}");

    await userEvent.click(await screen.findByRole("button", { name: /^Submit$/ }));
    expect(await screen.findByRole("heading", { name: /2 rows submitted successfully/i })).toBeInTheDocument();
  });
});
