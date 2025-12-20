const express = require('express');
const router = express.Router();
const allAffiliateData = require('../dummyJson/affiliateData.json');

// Helper to find and format a company payload from the loaded data
const findAndFormatCompanyPayload = (affiliateId, companyId) => {
    const affiliateEntry = allAffiliateData.find(aff => aff.id.toString() === affiliateId.toString());

    if (!affiliateEntry) {
        return null; // Affiliate not found
    }

    // Find the specific company within this affiliate's companies array
    const companyPayload = affiliateEntry.companies.find(comp => comp.id.toString() === companyId.toString());

    return companyPayload;
};

// Route to get all companies for an affiliate
router.get('/:affiliateId', (req, res) => {
    const { affiliateId } = req.params;

    const affiliateEntry = allAffiliateData.find(aff => aff.id.toString() === affiliateId.toString());

    if (!affiliateEntry) {
        return res.status(404).json({ error: "Affiliate not found" });
    }

    // Return the array of companies directly from the affiliateEntry
    res.set('Cache-Control', 'no-store');
    res.json(affiliateEntry.companies);
});

// Route to get a single company entry for an affiliate
router.get('/:affiliateId/company/:companyId', (req, res) => {
    const { affiliateId, companyId } = req.params;

    const companyPayload = findAndFormatCompanyPayload(affiliateId, companyId);

    if (!companyPayload) {
        return res.status(404).json({ error: "Company not found for this affiliate" });
    }

    res.json(companyPayload);
});

module.exports = router;