require('dotenv').config();

const API_KEY = process.env.VESTED_API_KEY;
const BASE_URL = process.env.VESTED_BASE_URL || 'https://api.vestedimpact.co.uk/v2';
const ASSET_URL = `${BASE_URL}/asset`;

const fs = require('fs');
const path = require('path');

async function main() {
    const companiesPath = path.join(__dirname, 'dummyJson', 'companies.json');
    const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));

    const results = {};

    console.log(`Checking ${companies.length} companies...`);

    for (const company of companies) {
        const qwrPath = path.join(__dirname, 'dummyJson', 'questionsWithResponses.json');
        const qwr = JSON.parse(fs.readFileSync(qwrPath, 'utf8'));
        const q1 = qwr.find(q => q.id === 1);
        const resp = q1.responses.find(r => r.user_profile__company_id === company.id);
        const validIndustry = resp ? resp.value : "General";

        console.log(`\nCompany: ${company.name} (${validIndustry})`);

        const asset = {
            name: `${company.name} ValidCheck`,
            description: company.about || "Description placeholder",
            industry: validIndustry,
            hqCountryCode: (company.locations[0] && company.locations[0].country_code) || "GB",
            numEmployees: 100
        };

        try {
            const response = await fetch(ASSET_URL, {
                method: 'POST',
                headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify(asset)
            });

            if (!response.ok) {
                console.error(`  Create failed: ${response.status}`);
                continue;
            }

            const data = await response.json();
            const suggestions = data.suggestedActivities || [];

            if (suggestions.length > 0) {
                console.log(`  First Suggestion: ${suggestions[0].id} - ${suggestions[0].name}`);
                results[company.id] = suggestions[0].id;
            } else {
                console.log(`  No suggestions.`);
            }

            // Cleanup
            await fetch(`${ASSET_URL}/id/${data.asset.id}`, {
                method: 'DELETE',
                headers: { 'api-key': API_KEY }
            });

        } catch (err) {
            console.error("  Error:", err.message);
        }
    }

    console.log("\n--- Recommended IDs ---");
    console.log(JSON.stringify(results, null, 2));
}

main();
