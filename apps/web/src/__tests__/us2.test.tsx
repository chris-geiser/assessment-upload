import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NOT_PRESENT } from "@assessment/shared";
import App from "../App.js";
import { SessionProvider } from "../auth/SessionContext.js";

const SESSION = {
  userId: "u1", name: "Sam Carter", role: "SCHOOL_ADMIN",
  schools: [{ schoolId: "s1", schoolName: "Lincoln Elementary", districtId: "d1", districtName: "Springfield USD" }],
};

// Renamed DIBELS headers that only map via synonyms (LASID, "LNF - Fall Score", ...).
const RENAMED_CSV =
  "LASID,Student First Name,Student Last Name,School Name,Grade Level,LNF - Fall Score,PSF - Fall Score,NWF-CLS - Fall Score,NWF-WWR - Fall Score,WRF - Fall Score,ORF - Fall Score,ORF - Fall Accuracy,MAZE - Fall Raw Score\n" +
  "3001,Ada,Lovelace,Lincoln Elementary,1,40,35,30,12,25,50,95,\n";

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/session") && method === "GET") {
      return new Response(JSON.stringify(SESSION), { status: 200 });
    }
    if (url.endsWith("/api/uploads") && method === "POST") {
      return new Response(
        JSON.stringify({ uploadId: "up-1", detection: { detected: "DIBELS_8", confidence: 1, ambiguous: false, scores: {}, ranked: [] }, duplicate: null }),
        { status: 201 },
      );
    }
    return new Response("{}", { status: 200 });
  });
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

async function goToMapStage() {
  render(
    <SessionProvider>
      <App />
    </SessionProvider>,
  );
  await screen.findByRole("heading", { name: /upload a file/i });
  await userEvent.selectOptions(screen.getByLabelText("Benchmark period"), "MOY");
  await userEvent.upload(fileInput(), new File([RENAMED_CSV], "renamed.csv", { type: "text/csv" }));
  await userEvent.click(await screen.findByRole("button", { name: /Continue to mapping/i }));
  await screen.findByText(/Review column mapping/i);
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});
afterEach(() => vi.unstubAllGlobals());

describe("US2: column mapping", () => {
  it("auto-maps renamed headers via synonyms at High confidence", async () => {
    await goToMapStage();
    const studentId = screen.getByLabelText("Student ID *") as HTMLSelectElement;
    expect(studentId.value).toBe("LASID");
    const lnf = screen.getByLabelText("LNF") as HTMLSelectElement;
    expect(lnf.value).toBe("LNF - Fall Score");
    // Grouped layout is present.
    expect(screen.getByText("Student Info")).toBeInTheDocument();
    expect(screen.getByText("Assessment Measures")).toBeInTheDocument();
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
  });

  it("lets the user override a mapping and reset back to auto-mapped", async () => {
    await goToMapStage();
    const lnf = screen.getByLabelText("LNF") as HTMLSelectElement;
    await userEvent.selectOptions(lnf, NOT_PRESENT);
    expect(lnf.value).toBe(NOT_PRESENT);

    await userEvent.click(screen.getByRole("button", { name: /Reset to Auto-Mapped/i }));
    expect((screen.getByLabelText("LNF") as HTMLSelectElement).value).toBe("LNF - Fall Score");
  });

  it("blocks advancing when a required field is unmapped, naming the field", async () => {
    await goToMapStage();
    const studentId = screen.getByLabelText("Student ID *") as HTMLSelectElement;
    await userEvent.selectOptions(studentId, NOT_PRESENT);
    await userEvent.click(screen.getByRole("button", { name: /Continue to validation/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/Student ID/);
    // Still on the mapping stage (validation placeholder not shown).
    expect(screen.getByText(/Review column mapping/i)).toBeInTheDocument();
  });
});
