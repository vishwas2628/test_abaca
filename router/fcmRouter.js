const express = require('express');
const router = express.Router();
const FcmToken = require('../models/fcmToken');

// Store FCM Token
// Endpoint: POST /fcmregistrationtoken
router.post('/fcmregistrationtoken', async (req, res) => {
    // Expects: { extension, FCMRegistrationToken, ...others ignored }
    const { extension, FCMRegistrationToken } = req.body;

    if (!extension || !FCMRegistrationToken) {
        return res.status(400).json({ error: "Missing extension or FCMRegistrationToken" });
    }

    try {
        // Store/update the token in MongoDB
        await FcmToken.upsertToken(extension, FCMRegistrationToken);
        console.log(`[FCM] Stored token for extension: ${extension} in MongoDB`);

        res.status(200).json({ message: "Token stored successfully" });
    } catch (error) {
        console.error('[FCM] Error storing token:', error);
        res.status(500).json({ error: "Failed to store token" });
    }
});

// Fetch FCM Token
// Endpoint: POST /getfcmregistrationtoken/
router.post('/getfcmregistrationtoken/', async (req, res) => {
    // Expects: { extension, ...others ignored }
    const { extension } = req.body;

    if (!extension) {
        console.error("[FCM] Fetch failed: Missing extension");
        return res.status(400).json({ error: "Missing extension" });
    }

    try {
        // Retrieve from MongoDB
        const token = await FcmToken.findByExtension(extension);

        if (!token) {
            console.warn(`[FCM] No token found in MongoDB for extension: ${extension}`);
        } else {
            console.log(`[FCM] Retrieved token from MongoDB for extension: ${extension}`);
        }

        res.json({ Token: token });
    } catch (error) {
        console.error('[FCM] Error fetching token:', error);
        res.status(500).json({ error: "Failed to fetch token" });
    }
});

module.exports = router;
