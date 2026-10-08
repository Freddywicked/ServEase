// src/utils/push.js
// Firebase Cloud Messaging push notifications.
//
// Config (either one):
//   FIREBASE_SERVICE_ACCOUNT_JSON — the whole service-account JSON as an env var
//                                   (use this on Render: paste the file's contents)
//   FIREBASE_SERVICE_ACCOUNT_PATH — path to the JSON file (local dev, e.g.
//                                   ./secrets/firebase-service-account.json)
// Without config, pushes are skipped with a log line — the in-app notifications
// (the notifications table) keep working regardless.
//
// Every NOTIFICATION row also becomes a push: workflow_model.notify() calls
// sendPushToUser(). The mobile app registers its token via POST /api/devices.
const path = require('path');
const config = require('../config');

let admin = null;
let initError = null;

const getAdmin = () => {
  if (admin || initError) return admin;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const filePath = config.firebase.serviceAccountPath;
    if (!raw && !filePath) {
      initError = 'no FIREBASE_SERVICE_ACCOUNT_JSON / _PATH configured';
      return null;
    }
    // Lazy require: firebase-admin is heavy and only needed once pushing is on.
    const firebaseAdmin = require('firebase-admin');
    const credential = raw
      ? firebaseAdmin.credential.cert(JSON.parse(raw))
      : firebaseAdmin.credential.cert(require(path.resolve(filePath)));
    firebaseAdmin.initializeApp({ credential });
    admin = firebaseAdmin;
  } catch (err) {
    initError = err.message;
    console.error('[push] Firebase init failed:', err.message);
  }
  return admin;
};

// Sends a push to every registered device of the user. Tokens FCM rejects as
// dead are removed so the table stays clean.
const sendPushToUser = async (userId, { title, body, data = {} }) => {
  const firebaseAdmin = getAdmin();
  if (!firebaseAdmin) {
    if (initError) console.log(`[push] skipped (${initError})`);
    return;
  }
  // Lazy require avoids a load-time cycle: workflow_model <-> push.
  const Workflow = require('../models/workflow_model');
  const tokens = await Workflow.listDeviceTokens(userId);
  if (!tokens.length) return;

  const response = await firebaseAdmin.messaging().sendEachForMulticast({
    tokens,
    // `notification` renders in the system tray when the app is backgrounded/quit;
    // `data` reaches the JS handlers (foreground) for in-app refreshes.
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  });

  response.responses.forEach((r, i) => {
    const code = r.error?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      Workflow.deleteDeviceToken(tokens[i]).catch(() => {});
    } else if (r.error) {
      console.error('[push] send failed:', r.error.message);
    }
  });
};

module.exports = { sendPushToUser };
