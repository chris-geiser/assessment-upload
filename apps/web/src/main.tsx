import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import { SessionProvider } from "./auth/SessionContext.js";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element missing");

createRoot(rootEl).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
