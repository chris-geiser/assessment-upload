import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.js";
import { SessionProvider } from "../auth/SessionContext.js";

const SESSION = {
  userId: "u1",
  name: "Sam Carter",
  role: "SCHOOL_ADMIN",
  schools: [
    { schoolId: "s1", schoolName: "Lincoln Elementary", districtId: "d1", districtName: "Springfield USD" },
  ],
};

const DIBELS_CSV =
  "Student ID,First Name,Last Name,School,Grade,LNF,PSF,NWF-CLS,NWF-WRC,WRF,ORF,ORF-Accuracy,MAZE\n" +
  "1001,Ada,Lovelace,Lincoln Elementary,1,40,35,30,12,25,50,95,\n";

const AMBIGUOUS_CSV =
  "Student ID,First Name,Last Name,School,Grade,Phonics,Vocabulary,Comprehension\n" +
  "A1,Sam,Reed,Lincoln Elementary,1,12,14,10\n";

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/session") && method === "GET") {
      return new Response(JSON.stringify(SESSION), { status: 200 });
    }
    if (url.endsWith("/api/uploads") && method === "POST") {
      return new Response(
        JSON.stringify({
          uploadId: "up-1",
          detection: { detected: "DIBELS_8", confidence: 1, ambiguous: false, scores: {}, ranked: [] },
          duplicate: null,
        }),
        { status: 201 },
      );
    }
    return new Response("{}", { status: 200 });
  });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

async function renderPage() {
  render(
    <SessionProvider>
      <App />
    </SessionProvider>,
  );
  await screen.findByRole("heading", { name: /assessment data/i });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", mockFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("US1: upload and preview", () => {
  it("shows the auto-detected assessment badge and a change-type link", async () => {
    await renderPage();
    await userEvent.upload(fileInput(), new File([DIBELS_CSV], "dibels.csv", { type: "text/csv" }));

    const preview = await screen.findByRole("region", { name: /file preview/i });
    expect(within(preview).getByText(/DIBELS 8th Edition \(auto-detected\)/)).toBeInTheDocument();
    expect(within(preview).getByText(/Not the right assessment\? Change type/)).toBeInTheDocument();
    expect(within(preview).getByText("dibels.csv")).toBeInTheDocument();
  });

  it("prompts for manual type selection when detection is ambiguous", async () => {
    await renderPage();
    await userEvent.upload(fileInput(), new File([AMBIGUOUS_CSV], "mystery.csv", { type: "text/csv" }));

    const preview = await screen.findByRole("region", { name: /file preview/i });
    expect(within(preview).getByText(/could not confidently detect/i)).toBeInTheDocument();
    expect(within(preview).getByLabelText("Assessment type")).toBeInTheDocument();
  });

  it("removes the file and returns to the upload zone", async () => {
    await renderPage();
    await userEvent.upload(fileInput(), new File([DIBELS_CSV], "dibels.csv", { type: "text/csv" }));
    await screen.findByRole("region", { name: /file preview/i });

    await userEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(screen.queryByRole("region", { name: /file preview/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Upload a file/i)).toBeInTheDocument();
  });

  it("advances the stepper to Map after selecting a period and continuing", async () => {
    await renderPage();
    await userEvent.selectOptions(screen.getByLabelText("Benchmark period"), "MOY");
    await userEvent.upload(fileInput(), new File([DIBELS_CSV], "dibels.csv", { type: "text/csv" }));

    const continueBtn = await screen.findByRole("button", { name: /Continue to mapping/i });
    await userEvent.click(continueBtn);

    await waitFor(() => {
      const stepper = screen.getByRole("navigation", { name: /upload progress/i });
      const upload = within(stepper).getByText("Upload").closest("li");
      const map = within(stepper).getByText("Map").closest("li");
      expect(map).toHaveAttribute("aria-current", "step");
      expect(upload).not.toHaveAttribute("aria-current");
    });
  });
});
