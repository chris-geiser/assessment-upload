import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../App.js";

describe("App", () => {
  it("renders the page heading", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /assessment data upload/i }),
    ).toBeInTheDocument();
  });
});
