import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const METHODS = new Set(["password", "google", "signup"]);

function clientDetails(userAgent = "") {
  const browser = /Edg\//.test(userAgent) ? "Edge"
    : /Chrome\//.test(userAgent) ? "Chrome"
      : /Firefox\//.test(userAgent) ? "Firefox"
        : /Safari\//.test(userAgent) ? "Safari"
          : "Browser";
  const os = /Android/.test(userAgent) ? "Android"
    : /iPhone|iPad/.test(userAgent) ? "iOS"
      : /Windows/.test(userAgent) ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent) ? "macOS"
          : /Linux/.test(userAgent) ? "Linux"
            : "Unknown OS";
  return { browser, os, device: `${browser} on ${os}` };
}

function requestIp(rawRequest) {
  return String(rawRequest.ip || "Unknown").trim().slice(0, 64);
}

export const recordLoginAudit = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");
  const method = String(request.data?.method || "");
  if (!METHODS.has(method)) throw new HttpsError("invalid-argument", "Unknown login method.");

  const now = Date.now();
  const uid = request.auth.uid;
  const stateRef = db.doc(`loginAuditState/${uid}`);
  const eventRef = db.collection("loginEvents").doc();
  const ownerRef = db.collection("ownerLoginAudits").doc(eventRef.id);
  const details = clientDetails(request.rawRequest.get("user-agent") || "");

  await db.runTransaction(async (transaction) => {
    const state = await transaction.get(stateRef);
    const lastRecordedAt = Number(state.data()?.lastRecordedAt || 0);
    if (now - lastRecordedAt < 10_000) return;
    transaction.set(stateRef, { lastRecordedAt: now }, { merge: true });
    transaction.set(eventRef, { userId: uid, method, ...details, createdAt: now });
    transaction.set(ownerRef, {
      userId: uid,
      email: String(request.auth.token.email || ""),
      method,
      ipAddress: requestIp(request.rawRequest),
      ...details,
      createdAt: now,
    });
  });
  return { recorded: true };
});
