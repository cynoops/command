/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const crypto = require("node:crypto");
const {setGlobalOptions} = require("firebase-functions");
const {onRequest, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });
admin.initializeApp();

const db = admin.firestore();
const liveApiKeysCollection = db.collection("live-api-keys");
const API_KEY_HEADER_CANDIDATES = [
  "x-api-key",
  "x-apikey",
  "apikey",
  "x-live-api-key",
];
const LIVE_UPDATE_DOCUMENT_TYPES = ["trackers", "features"];

const getCorsContext = (request) => {
  const origin = request.headers.origin || "*";
  const allowHeaders =
    request.headers["access-control-request-headers"] ||
    "content-type,x-api-key,x-live-api-key,x-apikey,apikey,api-key,live-type";
  return {
    origin,
    allowHeaders,
    allowMethods: "POST, PATCH, DELETE, OPTIONS",
  };
};

const applyCorsHeaders = (response, corsContext) => {
  response.set("Access-Control-Allow-Origin", corsContext.origin);
  response.set("Access-Control-Allow-Headers", corsContext.allowHeaders);
  response.set("Access-Control-Allow-Methods", corsContext.allowMethods);
  response.set("Vary", "Origin");
};

const normalizeHeaders = (headers) => {
  if (!headers) return {};
  if (typeof headers.get === "function") {
    const normalized = {};
    for (const [key, value] of headers.entries()) {
      normalized[key.toLowerCase()] = value;
    }
    return normalized;
  }
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
};

const extractApiKey = (headers = {}) => {
  for (const headerName of API_KEY_HEADER_CANDIDATES) {
    const value = headers[headerName] ?? headers[headerName.toLowerCase()];
    if (value !== undefined) {
      const rawValue = Array.isArray(value) ? value[0] : value;
      const normalized =
        typeof rawValue === "string" ? rawValue.trim() : rawValue;
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
};

const LIVE_API_KEY_FIELD_CANDIDATES = ["apiKey", "key", "value"];

const extractLiveUpdateDocumentType = (headers = {}) => {
  const value = headers["live-type"];
  if (value === undefined) return undefined;
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== "string") return undefined;
  const normalized = rawValue.trim().toLowerCase();
  if (LIVE_UPDATE_DOCUMENT_TYPES.includes(normalized)) {
    return normalized;
  }
  return undefined;
};

const ensureJsonObjectBody = (request) => {
  const { body } = request;
  if (body === undefined || body === null || body === "") {
    return {};
  }
  if (Buffer.isBuffer(body)) {
    try {
      const parsed = JSON.parse(body.toString("utf8"));
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (error) {
      throw new HttpsError("invalid-argument", "Request body must be valid JSON.");
    }
  }
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (error) {
      throw new HttpsError("invalid-argument", "Request body must be valid JSON.");
    }
  }
  if (typeof body === "object") {
    return body;
  }
  throw new HttpsError("invalid-argument", "Unsupported request body format.");
};

const deleteCollectionDocuments = async (collectionRef, batchSize = 200) => {
  let deletedCount = 0;
  // Loop until the collection snapshot comes back empty.
  // Batch writes avoid exhausting quotas while keeping requests small.
  for (;;) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      break;
    }

    const batch = collectionRef.firestore.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deletedCount += snapshot.size;
  }
  return deletedCount;
};

const findLiveApiKeyDoc = async (apiKey) => {
  if (!apiKey) return null;

  if (!apiKey.includes("/")) {
    const directDoc = await liveApiKeysCollection.doc(apiKey).get();
    if (directDoc.exists) {
      return directDoc;
    }
  }

  for (const fieldName of LIVE_API_KEY_FIELD_CANDIDATES) {
    const snapshot = await liveApiKeysCollection
      .where(fieldName, "==", apiKey)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      return snapshot.docs[0];
    }
  }

  return null;
};

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.apiLive = onRequest(
  {
    invoker: "public",
  },
  async (request, response) => {
    const corsContext = getCorsContext(request);
    try {
      if (request.method === "OPTIONS") {
        applyCorsHeaders(response, corsContext);
        response.status(204).send("");
        return;
      }

      const method =
        typeof request.method === "string" ? request.method.toUpperCase() : "";
      if (!["POST", "PATCH", "DELETE"].includes(method)) {
        throw new HttpsError(
          "failed-precondition",
          "Only POST, PATCH and DELETE are supported.",
        );
      }

      const normalizedHeaders = normalizeHeaders(request.headers);
      const apiKey = extractApiKey(normalizedHeaders);
      if (!apiKey) {
        throw new HttpsError("invalid-argument", "Missing API key header.");
      }

      const apiKeyDoc = await findLiveApiKeyDoc(apiKey);
      if (!apiKeyDoc) {
        logger.warn("Rejected request with invalid API key", {
          apiKeyHash: crypto.createHash("sha256").update(apiKey).digest("hex"),
        });
        throw new HttpsError("permission-denied", "Invalid API key.");
      }

      if (method === "PATCH") {
        const liveType = extractLiveUpdateDocumentType(normalizedHeaders);
        if (!liveType) {
          throw new HttpsError(
            "invalid-argument",
            "Missing or invalid live-type header.",
          );
        }

        const body = ensureJsonObjectBody(request);
        const rawSessionId = body.sessionId;
        if (typeof rawSessionId !== "string" || rawSessionId.trim() === "") {
          throw new HttpsError(
            "invalid-argument",
            "sessionId must be a non-empty string.",
          );
        }

        const updates = body.data;
        if (updates === undefined || updates === null) {
          throw new HttpsError(
            "invalid-argument",
            "Request body must include data object.",
          );
        }
        if (typeof updates !== "object" || Array.isArray(updates)) {
          throw new HttpsError(
            "invalid-argument",
            "data must be an object.",
          );
        }

        const sessionId = rawSessionId.trim();
        const liveApiDocRef = db.collection("live-api").doc(sessionId);
        const liveApiDoc = await liveApiDocRef.get();

        if (!liveApiDoc.exists) {
          throw new HttpsError("not-found", "Live update session not found.");
        }

        if (liveApiDoc.get("apiKeyId") !== apiKeyDoc.id) {
          throw new HttpsError(
            "permission-denied",
            "Live update session does not belong to the provided API key.",
          );
        }

        const targetDocRef = liveApiDocRef.collection("trackers").doc(liveType);

        await targetDocRef.set(
          {
            ...updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

        logger.info("Live API updates document patched", {
          liveApiDocId: sessionId,
          updatesDoc: liveType,
          apiKeyRef: apiKeyDoc.ref.path,
        });

        applyCorsHeaders(response, corsContext);
        response.json(true);
        return;
      }

      if (method === "DELETE") {
        const body = ensureJsonObjectBody(request);
        const rawSessionId = body.sessionId;
        if (typeof rawSessionId !== "string" || rawSessionId.trim() === "") {
          throw new HttpsError(
            "invalid-argument",
            "sessionId must be a non-empty string.",
          );
        }

        const sessionId = rawSessionId.trim();
        const liveApiDocRef = db.collection("live-api").doc(sessionId);
        const liveApiDoc = await liveApiDocRef.get();

        if (!liveApiDoc.exists) {
          throw new HttpsError("not-found", "Live update session not found.");
        }

        if (liveApiDoc.get("apiKeyId") !== apiKeyDoc.id) {
          throw new HttpsError(
            "permission-denied",
            "Live update session does not belong to the provided API key.",
          );
        }

        await liveApiDocRef.delete();

        logger.info("Live API session deleted", {
          liveApiDocId: sessionId,
          apiKeyRef: apiKeyDoc.ref.path,
        });

        applyCorsHeaders(response, corsContext);
        response.json(true);
        return;
      }

      const authToken = crypto.randomBytes(32).toString("hex");
      const liveApiDocRef = db.collection("live-api").doc();
      const updatesCollectionPath = `${liveApiDocRef.path}/trackers`;

      await db.runTransaction(async (transaction) => {
        transaction.set(liveApiDocRef, {
          apiKeyId: apiKeyDoc.id,
          authToken,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatesCollectionPath,
        });

        const updatesCollectionRef = liveApiDocRef.collection("trackers");
        transaction.set(updatesCollectionRef.doc("trackers"), {
          initializedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        transaction.set(updatesCollectionRef.doc("features"), {
          initializedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      const firebaseAuthToken = await admin.auth().createCustomToken(
        `liveApi_${liveApiDocRef.id}`,
        {
          liveApiDocId: liveApiDocRef.id,
          liveApiAuthToken: authToken,
        },
      );

      logger.info("Live API access granted", {
        liveApiDocId: liveApiDocRef.id,
        apiKeyRef: apiKeyDoc.ref.path,
      });

      applyCorsHeaders(response, corsContext);
      response.json({
        liveApiDocId: liveApiDocRef.id,
        authToken,
        firebaseAuthToken,
        updatesCollectionPath,
      });
    } catch (error) {
      if (error instanceof HttpsError) {
        logger.warn("API request rejected", {
          code: error.code,
          message: error.message,
        });
        const corsContext = getCorsContext(request);
        applyCorsHeaders(response, corsContext);
        response.status(mapHttpsErrorToStatus(error.code)).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      logger.error("API function error", {
        message: error?.message,
        stack: error?.stack,
      });

      applyCorsHeaders(response, corsContext);
      response.status(500).json({
        error: {
          code: "internal",
          message: "Internal error.",
        },
      });
    }
  },
);

exports.cleanupExpiredLiveSessions = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Etc/UTC",
    retryCount: 3,
  },
  async () => {
    const tenDaysAgo = admin.firestore.Timestamp.fromMillis(
      Date.now() - 10 * 24 * 60 * 60 * 1000,
    );

    const snapshot = await db
      .collection("live-api")
      .where("createdAt", "<=", tenDaysAgo)
      .get();

    if (snapshot.empty) {
      logger.debug("No expired live API sessions found for cleanup.");
      return;
    }

    let sessionsDeleted = 0;
    let updatesDeleted = 0;

    for (const doc of snapshot.docs) {
      const sessionId = doc.id;
      const updatesRef = doc.ref.collection("trackers");

      try {
        updatesDeleted += await deleteCollectionDocuments(updatesRef);
      } catch (error) {
        logger.error("Failed to delete updates for session.", {
          sessionId,
          error: error?.message,
        });
        // Skip deleting the session document so it can be retried later.
        continue;
      }

      try {
        await doc.ref.delete();
        sessionsDeleted += 1;
      } catch (error) {
        logger.error("Failed to delete expired session document.", {
          sessionId,
          error: error?.message,
        });
      }
    }

    logger.info("Expired live API session cleanup completed.", {
      sessionsDeleted,
      updatesDeleted,
    });
  },
);

const mapHttpsErrorToStatus = (code) => {
  switch (code) {
    case "invalid-argument":
      return 400;
    case "failed-precondition":
      return 412;
    case "permission-denied":
      return 403;
    case "not-found":
      return 404;
    case "unauthenticated":
      return 401;
    case "already-exists":
      return 409;
    case "resource-exhausted":
      return 429;
    case "cancelled":
      return 499;
    case "data-loss":
      return 500;
    case "unknown":
    default:
      return 500;
  }
};
