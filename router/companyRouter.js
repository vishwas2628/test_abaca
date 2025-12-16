const express = require('express');
const router = express.Router();

// Middleware to check authentication state without blocking
const checkAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = process.env.API_TOKEN;

    if (authHeader && token && authHeader.includes(token)) {
        req.isAuthenticated = true;
    } else {
        req.isAuthenticated = false;
    }
    next();
};

const companies = require('../dummyJson/companies.json');
const assessments = require('../dummyJson/assessments.json');

// Helper to find company by ID or Access Hash
const findCompany = (abacaId) => {
    return companies.find(c => c.id.toString() === abacaId || c.access_hash === abacaId);
};

// Company Details Endpoint
// Permissions: IsAuthenticatedOrReadOnly
router.get('/:abacaId', checkAuth, (req, res) => {
    const { abacaId } = req.params;
    const company = findCompany(abacaId);

    if (!company) {
        return res.status(404).json({ error: "Company not found" });
    }

    if (req.isAuthenticated) {
        // Full Details
        res.json(company);
    } else {
        // Partial Details
        const {
            id, name, logo, about, website, email, founded_date, locations, sectors, type, access_hash
        } = company;

        res.json({
            id, name, logo, about, website, email, founded_date, locations, sectors, type, access_hash
        });
    }
});

// Company Assessments Endpoint
router.get('/:abacaId/assessments', (req, res) => {
    const { abacaId } = req.params;
    const company = findCompany(abacaId);

    if (!company) {
        return res.status(404).json({ error: "Company not found" });
    }

    // Filter assessments for this company
    const companyAssessments = assessments.filter(a => a.evaluated === company.id);
    res.json(companyAssessments);
});

module.exports = router;
