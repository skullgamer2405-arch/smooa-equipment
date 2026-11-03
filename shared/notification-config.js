export const validEmail = value => typeof value === "string" && value.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value);
export const validWebhook = url => typeof url === "string" && (!url || /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url));

// Admin recipients only: borrower and SMTP sender validation stays single-address.
export function parseAdminEmails(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
  const entries = value.split(",");
  if (entries.length > 2) return null;
  const addresses = entries.map(entry => entry.trim());
  if (!addresses.every(validEmail)) return null;
  return addresses.filter((address, index) => addresses.findIndex(other => other.toLowerCase() === address.toLowerCase()) === index);
}
