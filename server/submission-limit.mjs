import { createHash } from "node:crypto";
import { ApiError } from "./http.mjs";

// Read before other transaction writes; commit the returned update with the booking.
export async function submissionLimit(tx, db, principal, now) {
  const key = createHash("sha256").update(principal + ":" + Math.floor(+now / 60000)).digest("hex");
  const ref = db.collection("submissionLimits").doc(key);
  const count = (await tx.get(ref)).data()?.count || 0;
  if (count >= 30) throw new ApiError(429, "ส่งคำขอถี่เกินไป กรุณารอสักครู่");
  return { ref, value: { count: count + 1, expiresAt: new Date(+now + 3600000) } };
}
