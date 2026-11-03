// Playwright replaces the data/LINE modules with local fixtures before loading.
// This harness never initializes Firebase or calls the LINE SDK.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LineProvider, useLine } from "../../src/line-context";
import "../../src/styles.css";

function Content() {
  const { consent, ready } = useLine();
  return (
    <main id="main" tabIndex={-1}>
      <h1>Isolated LINE consent fixture</h1>
      <output data-testid="consent">{consent ? "linked" : "unlinked"}</output>
      <output data-testid="ready">{String(ready)}</output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LineProvider>
        <Content />
      </LineProvider>
    </BrowserRouter>
  </StrictMode>,
);
