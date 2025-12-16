const express = require('express');
const router = express.Router();
const groups = require('../dummyJson/groups.json');

// Route: Get Group with Holdings
// Path: /user/company-lists/:uid/companies/
router.get('/:uid/companies', (req, res) => {
    const { uid } = req.params;

    // Find group by uid (or id for flexibility)
    const groupData = groups.find(g => g.uid === uid || g.id === uid);

    if (!groupData) {
        return res.status(404).json({ error: "Company list not found" });
    }

    // Transform to requested format
    const response = {
        group: {
            description: groupData.description,
            name: groupData.name,
            owner: groupData.owner
        },
        holdings: groupData.companies.map(c => ({
            id: c.id, // Keeping ID as is (integer or string from source)
            type: "ASSET",
            weight: c.weight
        }))
    };

    res.json(response);
});

module.exports = router;
