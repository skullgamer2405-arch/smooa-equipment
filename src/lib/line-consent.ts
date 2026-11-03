export type LineChoice = "" | "pending" | "accepted" | "declined";

// Scope notification consent to this LIFF app. Store no LINE identity or tokens.
const demo = import.meta.env.VITE_DEMO_MODE === "true";
export const linePreferenceKey = `smo-line-notifications-v2-${demo ? "demo" : `live:${import.meta.env.VITE_LINE_LIFF_ID || ""}`}`;
const legacyKey = `smo-line-notifications-v1-${demo ? "demo" : "live"}`;

export function savedLineChoice(): LineChoice {
  try {
    if (localStorage.getItem(linePreferenceKey) === "accepted")
      return "accepted";
  } catch {
    /* use session or in-memory preference when storage is blocked */
  }
  try {
    const value = sessionStorage.getItem(linePreferenceKey);
    if (value === "accepted" || value === "pending" || value === "declined")
      return value;
    // The old implementation saved "accepted" before login completed. Recheck it.
    const legacy = sessionStorage.getItem(legacyKey);
    return legacy === "accepted"
      ? "pending"
      : legacy === "declined"
        ? "declined"
        : "";
  } catch {
    return "";
  }
}

export function saveLineChoice(choice: Exclude<LineChoice, "">) {
  // Only a completed connection is remembered across browser sessions.
  if (choice === "accepted") {
    try {
      localStorage.setItem(linePreferenceKey, choice);
    } catch {
      /* session storage remains a fallback */
    }
  }
  try {
    sessionStorage.setItem(linePreferenceKey, choice);
    sessionStorage.removeItem(legacyKey);
  } catch {
    /* the provider retains the choice in memory */
  }
}
