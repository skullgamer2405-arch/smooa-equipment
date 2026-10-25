import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { lineEnabled, initializeLine } from "./lib/line";
// LIFF handles its primary/secondary redirect before the router reads the URL.
const ready = lineEnabled
  ? initializeLine().catch(() => undefined)
  : Promise.resolve();
void ready.then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
