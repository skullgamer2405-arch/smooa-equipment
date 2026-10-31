import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LineBootstrap } from "./line-bootstrap";
import "./styles.css";
// Ordinary routes render immediately; only LIFF callback routing waits for SDK cleanup.
createRoot(document.getElementById("root")!).render(
  <StrictMode><LineBootstrap/></StrictMode>,
);
