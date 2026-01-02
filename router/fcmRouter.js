const express = require('express');
const router = express.Router();

// Payload storage for FCM tokens
// Key: extension, Value: FCMRegistrationToken
const fcmPayload = {};

// Store FCM Token
// Endpoint: POST /fcmregistrationtoken
router.post('/fcmregistrationtoken', (req, res) => {
    // Expects: { extension, FCMRegistrationToken, ...others ignored }
    const { extension, FCMRegistrationToken } = req.body;

    if (!extension || !FCMRegistrationToken) {
        return res.status(400).json({ error: "Missing extension or FCMRegistrationToken" });
    }

    // Append/Update the token in the payload
    fcmPayload[extension] = FCMRegistrationToken;
    console.log(`[FCM] Stored token for extension: ${extension} in payload`);

    res.status(200).json({ message: "Token stored successfully" });
});

// Fetch FCM Token
// Endpoint: POST /getfcmregistrationtoken/
router.post('/getfcmregistrationtoken/', (req, res) => {
    // Expects: { extension, ...others ignored }
    const { extension } = req.body;

    if (!extension) {
        console.error("[FCM] Fetch failed: Missing extension");
        return res.status(400).json({ error: "Missing extension" });
    }

    // Retrieve from payload
    const token = fcmPayload[extension] || null;

    if (!token) {
        console.warn(`[FCM] No token found in payload for extension: ${extension}`);
    } else {
        console.log(`[FCM] Retrieved token from payload for extension: ${extension}`);
    }

    res.json({ Token: token });
});

module.exports = router;
