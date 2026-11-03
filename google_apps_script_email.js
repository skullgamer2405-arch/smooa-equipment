// Deploy as a Web App only after setting SMO_WEBHOOK_SECRET in Script Properties.
// Calls are signed by the server; no browser credential or arbitrary public email endpoint.
function doPost(event) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    var secret = PropertiesService.getScriptProperties().getProperty("SMO_WEBHOOK_SECRET");
    if (!secret || secret.length < 32) throw new Error("NOT_CONFIGURED");
    var envelope = JSON.parse(event.postData.contents);
    if (typeof envelope.payload !== "string" || envelope.payload.length > 16000 || typeof envelope.signature !== "string") throw new Error("INVALID");
    var digest = Utilities.computeHmacSha256Signature(envelope.payload, secret).map(function(byte) { return ((byte + 256) % 256).toString(16).padStart(2, "0"); }).join("");
    var mismatch = digest.length ^ envelope.signature.length;
    for (var i = 0; i < digest.length; i++) mismatch |= digest.charCodeAt(i) ^ (envelope.signature.charCodeAt(i) || 0);
    if (mismatch) throw new Error("UNAUTHORIZED");
    var payload = JSON.parse(envelope.payload);
    if (typeof payload.timestamp !== "number" || Math.abs(Date.now() - payload.timestamp) > 120000 || !/^[A-Za-z0-9_-]{1,180}$/.test(payload.requestId)) throw new Error("INVALID");
    var recipients = smoAdminEmails(payload.to);
    if (!recipients || (payload.kind && payload.kind !== "pending" && recipients.length !== 1)) throw new Error("INVALID");
    payload.to = recipients.join(",");
    if (typeof payload.subject !== "string" || payload.subject.length > 500 || typeof payload.html !== "string" || payload.html.length > 16000) throw new Error("INVALID");
    if (!lock.tryLock(5000)) throw new Error("BUSY");
    acquired = true;
    var cache = CacheService.getScriptCache();
    var previous = cache.get(payload.requestId);
    if (previous) return smoResult({ success: previous === "sent" });
    // Mark before sending: ambiguous failures require inspection rather than a duplicate email.
    cache.put(payload.requestId, "sending", 21600);
    MailApp.sendEmail({ to: payload.to, subject: payload.subject, body: "คำขอยืมอุปกรณ์ SMO.CRA กรุณาเปิดอีเมลแบบ HTML หรือดูรายละเอียดในเว็บ", htmlBody: payload.html });
    cache.put(payload.requestId, "sent", 21600);
    return smoResult({ success: true });
  } catch (error) {
    return smoResult({ success: false });
  } finally { if (acquired) lock.releaseLock(); }
}
function smoResult(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

// Keep the same bounded recipient rules as shared/notification-config.js.
function smoAdminEmails(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
  var entries = value.split(",");
  if (entries.length > 2) return null;
  var addresses = entries.map(function(entry) { return entry.trim(); });
  if (!addresses.every(function(address) { return address.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(address); })) return null;
  return addresses.filter(function(address, index) { return addresses.findIndex(function(other) { return other.toLowerCase() === address.toLowerCase(); }) === index; });
}
