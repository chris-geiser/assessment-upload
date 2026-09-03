import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { SessionProvider } from "./auth/SessionContext.js";
import { installMockApi } from "./demo/mockApi.js";
import "./index.css";

// Static demo build (GitHub Pages) has no backend: stub the API in the browser.
if ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEMO === "true") {
  installMockApi();
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element missing");

createRoot(rootEl).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
