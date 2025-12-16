const express = require('express');
const router = express.Router();

// Middleware to simulate Admin check (or reuse existing auth logic)
const checkAdmin = (req, res, next) => {
    // For this mock, we assume the user is an admin if they have the correct token (handled in main app or ignored here for simplicity)
    // Real implementation would check user role
    next();
};

const questionsWithResponsesData = require('../dummyJson/questionsWithResponses.json');
const companies = require('../dummyJson/companies.json');

// Helper to resolve companyId (ID or Hash) -> ID
const resolveCompanyId = (idOrHash) => {
    const company = companies.find(c => c.id.toString() === idOrHash || c.access_hash === idOrHash);
    return company ? company.id : null;
};

// Helper to filter responses by companyId
const filterResponsesByCompany = (data, companyIdOrHash) => {
    const targetCompanyId = resolveCompanyId(companyIdOrHash);

    if (!targetCompanyId) {
        // If we can't resolve the ID, and one was provided, maybe return empty responses or error?
        // Assuming if valid ID not found, return empty results for that "company"
        return data.map(q => ({ ...q, responses: [] }));
    }

    return data.map(question => {
        const newQuestion = { ...question };
        if (newQuestion.responses) {
            newQuestion.responses = newQuestion.responses.filter(
                response => response.user_profile__company_id === targetCompanyId
            );
        }
        return newQuestion;
    });
};

// Retrieve All: GET /matching/questions-with-responses/
router.get('/questions-with-responses', checkAdmin, (req, res) => {
    res.json(questionsWithResponsesData);
});

// Retrieve for Specific Company: GET /matching/questions-with-responses/:companyId
router.get('/questions-with-responses/:companyId', checkAdmin, (req, res) => {
    const { companyId } = req.params;
    const filteredData = filterResponsesByCompany(questionsWithResponsesData, companyId);
    res.json(filteredData);
});

module.exports = router;
