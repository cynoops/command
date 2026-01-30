const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const REGION = 'europe-west3';
const db = admin.firestore();

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const extractFromArray = (arr) => {
  if (!Array.isArray(arr) || arr.length < 2) return null;
  const a = toNumber(arr[0]);
  const b = toNumber(arr[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const aAbs = Math.abs(a);
  const bAbs = Math.abs(b);
  if (aAbs > 90 && bAbs <= 90) return { longitude: a, latitude: b };
  if (bAbs > 90 && aAbs <= 90) return { longitude: b, latitude: a };
  return { longitude: a, latitude: b };
};

const extractFromObject = (obj) => {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) return extractFromArray(obj);
  const lat = toNumber(obj.latitude ?? obj.lat ?? obj._lat);
  const lng = toNumber(obj.longitude ?? obj.lng ?? obj.lon ?? obj.long ?? obj._long ?? obj._lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const altitude = toNumber(obj.altitude ?? obj.alt ?? obj.elevation);
    return { longitude: lng, latitude: lat, altitude };
  }
  return null;
};

const extractCoordinates = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.coords,
    payload.location,
    payload.position,
    payload.geo,
    payload.geopoint,
    payload.point,
    payload.data,
    payload
  ];
  for (const candidate of candidates) {
    const coords = extractFromObject(candidate);
    if (coords && Number.isFinite(coords.longitude) && Number.isFinite(coords.latitude)) {
      return {
        longitude: coords.longitude,
        latitude: coords.latitude,
        altitude: Number.isFinite(coords.altitude) ? coords.altitude : null
      };
    }
  }
  return null;
};

const coordsMatch = (a, b) => {
  if (!a || !b) return false;
  const sameLng = Number(a.longitude) === Number(b.longitude);
  const sameLat = Number(a.latitude) === Number(b.latitude);
  const aAlt = Number.isFinite(a.altitude) ? a.altitude : null;
  const bAlt = Number.isFinite(b.altitude) ? b.altitude : null;
  return sameLng && sameLat && aAlt === bAlt;
};

const extractSpeed = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.speed,
    payload.coords?.speed,
    payload.location?.speed,
    payload.position?.speed,
    payload.data?.speed
  ];
  for (const c of candidates) {
    const n = toNumber(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const nextSuffix = (suffixChar) => {
  const s = String(suffixChar || '').toLowerCase();
  const c = s.charCodeAt(0);
  if (!c || c < 97 || c > 122) return 'b';
  if (c === 122) {
    throw new Error('Track document suffix overflow (reached _z).');
  }
  return String.fromCharCode(c + 1);
};

exports.trackersToUpdates = functions
  .region(REGION)
  .firestore
  .document('sessions/{sessionId}/trackers/{trackerId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) return null;

    const afterData = change.after.data() || {};
    const coords = extractCoordinates(afterData);
    if (!coords) return null;

    const beforeData = change.before.exists ? change.before.data() || {} : null;
    const prevCoords = beforeData ? extractCoordinates(beforeData) : null;
    if (prevCoords && coordsMatch(coords, prevCoords)) return null;

    const sessionId = String(context.params.sessionId || '').trim();
    const trackerId = String(context.params.trackerId || '').trim();
    if (!sessionId || !trackerId) return null;

    const speed = extractSpeed(afterData);

    const point = {
      coords: [coords.longitude, coords.latitude],
      altitude: Number.isFinite(coords.altitude) ? coords.altitude : null,
      speed: Number.isFinite(speed) ? speed : null,
      t: admin.firestore.Timestamp.now()
    };

    const baseRef = db
      .collection('sessions')
      .doc(sessionId)
      .collection('tracks')
      .doc(`${trackerId}_a`);

    return db.runTransaction(async (tx) => {
      const baseSnap = await tx.get(baseRef);

      const baseData = baseSnap.exists ? (baseSnap.data() || {}) : {};
      const currentSuffix = (baseData.next && typeof baseData.next === 'string')
        ? baseData.next.toLowerCase()
        : 'a';

      let targetSuffix = currentSuffix || 'a';
      let targetRef = db
        .collection('sessions')
        .doc(sessionId)
        .collection('tracks')
        .doc(`${trackerId}_${targetSuffix}`);

      let targetSnap = await tx.get(targetRef);
      let targetData = targetSnap.exists ? (targetSnap.data() || {}) : {};
      const currentLen = Array.isArray(targetData.coords) ? targetData.coords.length : 0;

      if (currentLen >= 250) {
        const newSuffix = nextSuffix(targetSuffix);
        targetSuffix = newSuffix;
        targetRef = db
          .collection('sessions')
          .doc(sessionId)
          .collection('tracks')
          .doc(`${trackerId}_${targetSuffix}`);

        targetSnap = await tx.get(targetRef);
        targetData = targetSnap.exists ? (targetSnap.data() || {}) : {};

        tx.set(
          baseRef,
          {
            trackerId,
            createdAt: baseData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            next: targetSuffix
          },
          { merge: true }
        );
      } else {
        tx.set(
          baseRef,
          {
            trackerId,
            createdAt: baseData.createdAt || admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }

      tx.set(
        targetRef,
        {
          trackerId,
          createdAt: (targetData && targetData.createdAt)
            ? targetData.createdAt
            : admin.firestore.FieldValue.serverTimestamp(),
          coords: admin.firestore.FieldValue.arrayUnion(point)
        },
        { merge: true }
      );

      return null;
    });
  });
