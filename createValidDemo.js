require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.VESTED_API_KEY;
const BASE_URL = process.env.VESTED_BASE_URL || 'https://api.vestedimpact.co.uk/v2';

if (!API_KEY) {
    console.error("VESTED_API_KEY not found in environment variables.");
    process.exit(1);
}

// Helper to fetch data
async function fetchData(endpoint) {
    const url = `${BASE_URL}/reference/${endpoint}`;
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, {
        headers: { 'api-key': API_KEY }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`Response from ${endpoint}:`, JSON.stringify(data).substring(0, 200));
    return data;
}

// Mapping of Company Name (partial) to Industry Name (keyword) and preferred currency
const companyConfig = [
    { name: "EcoFarms", keyword: "Agricultural", currency: "ETB" }, // Matches "Agricultural Inputs"
    { name: "TechSavvy", keyword: "Software", currency: "KES" }, // Matches "Application Software"
    { name: "SolarPower", keyword: "Renewable", currency: "UGX" }, // Try Renewable, else Energy
    { name: "HealthFirst", keyword: "Healthcare Services", currency: "NGN" }, // Try Services
    { name: "EduTech", keyword: "Education", currency: "GHS" },
    { name: "FinTrust", keyword: "Financial", currency: "RWF" },
    { name: "AgriCool", keyword: "Logistics", currency: "TZS" },
    { name: "CleanWater", keyword: "Water", currency: "EGP" },
    { name: "MarketConnect", keyword: "Retail", currency: "MAD" },
    { name: "BuildIt", keyword: "Construction", currency: "ZAR" },
    { name: "CloudNine", keyword: "Software", currency: "GBP" }
];

// Fallback if APIs fail or keywords don't match
const DEFAULT_CURRENCY = 'USD';

async function main() {
    try {
        // 1. Fetch Reference Data
        const countriesResp = await fetchData('countries');
        const countries = countriesResp.countries;

        const industriesResp = await fetchData('industries');
        const industries = industriesResp.industries;
        // const currencies = await fetchData('currencies'); // Failed with 404
        const currencies = [{ code: 'USD' }, { code: 'EUR' }, { code: 'GBP' }, { code: 'ETB' }, { code: 'KES' }, { code: 'UGX' }, { code: 'NGN' }, { code: 'GHS' }, { code: 'RWF' }, { code: 'TZS' }, { code: 'EGP' }, { code: 'MAD' }, { code: 'ZAR' }];

        console.log(`Loaded ${countries.length} countries, ${industries.length} industries.`);

        // Cache for activities: IndustryId -> [Activities]
        const activityCache = {};

        async function getActivities(industryId) {
            if (activityCache[industryId]) return activityCache[industryId];
            const activitiesResp = await fetchData(`activities/industry/${encodeURIComponent(industryId)}`);
            const activities = activitiesResp.activities || activitiesResp; // Handle possible { activities: [] } or []
            activityCache[industryId] = activities;
            return activities;
        }

        // 2. Load JSON files
        const companiesPath = path.join(__dirname, 'dummyJson', 'companies.json');
        const assessmentsPath = path.join(__dirname, 'dummyJson', 'assessments.json');
        const qwrPath = path.join(__dirname, 'dummyJson', 'questionsWithResponses.json');

        const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));
        const assessments = JSON.parse(fs.readFileSync(assessmentsPath, 'utf8'));
        const qwr = JSON.parse(fs.readFileSync(qwrPath, 'utf8'));

        // 3. Process Companies
        for (const company of companies) {
            console.log(`Processing ${company.name}...`);

            // A. Fix Location
            // Extract Country from formatted_address or use hardcoded knowledge if parsing fails?
            // Address format in file: "City, Country" or "Region, City, Country"
            // Let's assume the last part of formatted_address is the Country.
            const loc = company.locations[0];
            let countryName = "Unknown";
            if (loc && loc.formatted_address) {
                const parts = loc.formatted_address.split(',').map(s => s.trim());
                countryName = parts[parts.length - 1];
            }

            // Find country code
            let countryObj = countries.find(c => c.name.toLowerCase() === countryName.toLowerCase());
            if (!countryObj && countryName === "Egypt") {
                countryObj = countries.find(c => c.code === "EG"); // Manual override
            }
            // Fuzzy match country if not found
            if (!countryObj) {
                countryObj = countries.find(c => c.name.toLowerCase().includes(countryName.toLowerCase()));
            }

            let countryCode = "US"; // Default
            if (countryObj) {
                countryCode = countryObj.code;
                loc.country = countryObj.name;
                loc.country_code = countryObj.code;
                console.log(`  Set location to ${countryObj.name} (${countryCode})`);
            } else {
                console.warn(`  Could not find country '${countryName}' in reference data. Keeping original.`);
            }

            // B. Fix Industry/Sector & Activity
            const config = companyConfig.find(c => company.name.includes(c.name));
            let keyword = config ? config.keyword : "General";

            // Find best matching industry (which is a string)
            let industryName = industries.find(i => i.toLowerCase().includes(keyword.toLowerCase()));
            if (!industryName) {
                // Fallback attempts
                if (keyword === "Renewable") industryName = industries.find(i => i.toLowerCase().includes("energy"));
                if (keyword === "Healthcare Services") industryName = industries.find(i => i.toLowerCase().includes("healthcare"));
            }
            if (!industryName) {
                industryName = industries[0];
                console.warn(`  Could not find industry for '${keyword}', using '${industryName}'`);
            }

            // Fetch Activities
            // industryName is the ID/Name
            let acts = await getActivities(industryName);

            if (!acts || acts.length === 0) {
                console.error("  No activities found!");
                continue;
            }

            const activity = acts[0]; // Pick first one. Activity might be string or object? 
            // Let's assume object { id, name } based on previous assumption, but need to verify.
            // If industries were strings, activities might be objects.
            console.log(`  Selected Industry: ${industryName}, Activity: ${JSON.stringify(activity)}`);

            // Update Company Sector
            // In companies.json, sector has id and name. 
            // If activity is object { id, name }, use it. 
            // If activity is string, use matched name and generate (or fetch) ID?
            // "Aluminum Refining" in companies.json had id 18968. 
            // Reference.ts says activities return "Activities" type.
            // I'll assume it's object. If not, I'll log and fail in next run.

            company.sectors = [{
                id: activity.id,
                name: activity.name
            }];

            // C. Update Assessments
            // Assessments are linked by `evaluated: company.id`
            const assessment = assessments.find(a => a.evaluated === company.id);
            if (assessment) {
                assessment.data = assessment.data.map(d => ({ ...d, category: activity.id }));
                console.log(`  Updated assessment ${assessment.id} category to ${activity.id}`);
            }

            // D. Update QuestionsWithResponses
            // Update currency (Question 2002 -> responses link via user_profile__company_id)
            const currencyResp = qwr.find(q => q.id === 2002)?.responses.find(r => r.user_profile__company_id === company.id);
            if (currencyResp) {
                // Check if currency exists in reference
                let targetCurr = config ? config.currency : DEFAULT_CURRENCY;
                const isValidCurr = currencies.some(c => (c.code || c) === targetCurr); // c might be string or obj
                if (!isValidCurr) targetCurr = DEFAULT_CURRENCY;

                currencyResp.value = targetCurr;
            }

            // Update Activity Breakdown (Question 2005)
            const actResp = qwr.find(q => q.id === 2005)?.responses.find(r => r.user_profile__company_id === company.id);
            if (actResp) {
                // Value is a JSON string: "[{\"activityId\":101,\"countryCode\":\"JP\",\"weight\":1}]"
                const newVal = [{
                    activityId: activity.id,
                    countryCode: countryCode,
                    weight: 1
                }];
                actResp.value = JSON.stringify(newVal);
            }
        }

        // 4. Create New Valid Example if not exists
        const newId = 1011;
        if (!companies.find(c => c.id === newId)) {
            console.log("Creating new example company...");
            const newLocId = 5011;

            // Pick a country and industry
            const newCountry = countries.find(c => c.name === "United Kingdom") || countries[0];
            const newIndustryName = industries.find(i => i.includes("Technology") || i.includes("Software")) || industries[0];
            const newActs = await getActivities(newIndustryName);
            const newAct = newActs[0];

            const newCompany = {
                id: newId,
                type: 0,
                name: "CloudNine Systems",
                slug: "cloudnine-systems",
                logo: "https://via.placeholder.com/150",
                cover: "https://via.placeholder.com/600x200",
                about: "CloudNine Systems provides scalable cloud infrastructure solutions for startups.",
                website: "https://cloudnine.io",
                email: "contact@cloudnine.io",
                founded_date: "2023-01-01",
                locations: [{
                    id: newLocId,
                    formatted_address: `London, ${newCountry.name}`,
                    city: "London",
                    country: newCountry.name,
                    country_code: newCountry.code,
                    latitude: 51.5074,
                    longitude: -0.1278
                }],
                sectors: [{
                    id: newAct.id,
                    name: newAct.name
                }],
                networks: [],
                crunchbase_id: "",
                access_hash: `hash${newId}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            companies.push(newCompany);

            // Add corresponding assessment
            const newAssessmentId = 50011;
            assessments.push({
                id: newAssessmentId,
                level: assessments[0].level, // Copy level structure
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                data: [{ level: 1, category: newAct.id }],
                user: 3011,
                evaluated: newId,
                hash_token: `token${newId}`,
                state: 2,
                from_milestone_planner: false
            });

            // Add QwR responses
            // 1. Employees (2001)
            const qEmployees = qwr.find(q => q.id === 2001);
            qEmployees.responses.push({
                id: 5011,
                value: "10",
                user_profile__company_id: newId,
                created_at: new Date().toISOString()
            });

            // 2. Currency (2002)
            const qCurrency = qwr.find(q => q.id === 2002);
            qCurrency.responses.push({
                id: 5111,
                value: "GBP", // Assuming UK
                user_profile__company_id: newId,
                created_at: new Date().toISOString()
            });

            // 3. Revenue (2003)
            const qRev = qwr.find(q => q.id === 2003);
            qRev.responses.push({
                id: 5211,
                value: "100000",
                user_profile__company_id: newId,
                created_at: new Date().toISOString()
            });

            // 4. Growth (2004)
            const qGrowth = qwr.find(q => q.id === 2004);
            qGrowth.responses.push({
                id: 5311,
                value: "0",
                user_profile__company_id: newId,
                created_at: new Date().toISOString()
            });

            // 5. Activity Breakdown (2005)
            const qAct = qwr.find(q => q.id === 2005);
            const actVal = JSON.stringify([{
                activityId: newAct.id,
                countryCode: newCountry.code,
                weight: 1
            }]);
            qAct.responses.push({
                id: 5411,
                value: actVal,
                user_profile__company_id: newId,
                created_at: new Date().toISOString()
            });
        }

        // Remove duplicates if any (keep last one by ID)
        const uniqueCompanies = [];
        const map = new Map();
        for (const item of companies) {
            map.set(item.id, item);
        }
        for (const item of map.values()) {
            uniqueCompanies.push(item);
        }

        // Sort by ID
        uniqueCompanies.sort((a, b) => a.id - b.id);

        // Deduplicate Assessments & Ensure 1:1 Mapping with ID match
        const uniqueAssessments = [];
        const assessMap = new Map();

        // Load existing assessments into map by 'evaluated' (Company ID) to preserve data if possible
        for (const item of assessments) {
            assessMap.set(item.evaluated, item);
        }

        // Rebuild assessments list based on Companies
        for (const company of uniqueCompanies) {
            let assessment = assessMap.get(company.id);
            if (!assessment) {
                console.log(`Creating missing assessment for company ${company.id}...`);
                // Create default assessment if missing
                assessment = {
                    id: company.id, // Enforce same ID
                    level: {
                        id: 29,
                        value: 2,
                        title: "Validating the Problem-Solution Fit",
                        description: "Standard initial assessment.",
                        typical_funding: "Grants, Angel Investors",
                        group: 2
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    data: [{ level: 2, category: company.sectors && company.sectors[0] ? company.sectors[0].id : 0 }],
                    user: 3000 + company.id, // Mock user ID
                    evaluated: company.id,
                    hash_token: `token${company.id}`,
                    state: 2,
                    from_milestone_planner: false
                };
            } else {
                // Ensure ID matches Company ID
                if (assessment.id !== company.id) {
                    console.log(`Updating assessment ID from ${assessment.id} to ${company.id}`);
                    assessment.id = company.id;
                }
            }
            uniqueAssessments.push(assessment);
        }

        uniqueAssessments.sort((a, b) => a.id - b.id);

        // Deduplicate QwR Responses
        for (const q of qwr) {
            const uniqueResponses = [];
            const respMap = new Map();
            for (const r of q.responses) {
                // Key by user_profile__company_id to simplify (assuming 1 response per company per question)
                // Or key by ID. But IDs might be duplicated if I blindly pushed 5011.
                // If I used fixed ID 5011, then map.set(5011) keeps last one.
                respMap.set(r.id, r);
            }
            for (const r of respMap.values()) {
                uniqueResponses.push(r);
            }
            uniqueResponses.sort((a, b) => a.id - b.id); // Sort by ID?
            q.responses = uniqueResponses;
        }

        // 5. Save Files
        fs.writeFileSync(companiesPath, JSON.stringify(uniqueCompanies, null, 4));
        fs.writeFileSync(assessmentsPath, JSON.stringify(uniqueAssessments, null, 4));
        fs.writeFileSync(qwrPath, JSON.stringify(qwr, null, 4));

        console.log("Successfully updated all data files!");

    } catch (error) {
        console.error("Error in script:", error);
        process.exit(1);
    }
}

main();
