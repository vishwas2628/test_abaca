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
    // console.log(`Response from ${endpoint}:`, JSON.stringify(data).substring(0, 200));
    return data;
}

// Mapping of Company Name (partial) to Industry Name (keyword) and preferred currency
const companyConfig = [
    { name: "EcoFarms", keyword: "Agricultural", currency: "ETB" },
    { name: "TechSavvy", keyword: "Software", currency: "KES" },
    { name: "SolarPower", keyword: "Renewable", currency: "UGX" },
    { name: "HealthFirst", keyword: "Healthcare Services", currency: "NGN" },
    { name: "EduTech", keyword: "Education", currency: "GHS" },
    { name: "FinTrust", keyword: "Financial", currency: "RWF" },
    { name: "AgriCool", keyword: "Logistics", currency: "TZS" },
    { name: "CleanWater", keyword: "Water", currency: "EGP" },
    { name: "MarketConnect", keyword: "Retail", currency: "MAD" },
    { name: "BuildIt", keyword: "Construction", currency: "ZAR" },
    { name: "CloudNine", keyword: "Software", currency: "GBP" }
];

const DEFAULT_CURRENCY = 'USD';

async function main() {
    try {
        // 1. Fetch Reference Data
        const countriesResp = await fetchData('countries');
        const countries = countriesResp.countries;

        const industriesResp = await fetchData('industries');
        const industries = industriesResp.industries;

        console.log(`Loaded ${countries.length} countries, ${industries.length} industries.`);

        const activityCache = {};

        async function getActivities(industryId) {
            if (activityCache[industryId]) return activityCache[industryId];
            const activitiesResp = await fetchData(`activities/industry/${encodeURIComponent(industryId)}`);
            const activities = activitiesResp.activities || activitiesResp;
            activityCache[industryId] = activities;
            return activities;
        }

        // 2. Load JSON files
        const companiesPath = path.join(__dirname, 'dummyJson', 'companies.json');
        const assessmentsPath = path.join(__dirname, 'dummyJson', 'assessments.json');
        const qwrPath = path.join(__dirname, 'dummyJson', 'questionsWithResponses.json');

        const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));
        const assessments = JSON.parse(fs.readFileSync(assessmentsPath, 'utf8'));
        // Note: We do NOT load existing qwr because we will rebuild it completely.

        // 3. Process Companies
        for (const company of companies) {
            console.log(`Processing ${company.name}...`);

            // A. Fix Location
            const loc = company.locations[0];
            let countryName = "Unknown";
            if (loc && loc.formatted_address) {
                const parts = loc.formatted_address.split(',').map(s => s.trim());
                countryName = parts[parts.length - 1];
            }

            let countryObj = countries.find(c => c.name.toLowerCase() === countryName.toLowerCase());
            if (!countryObj && countryName === "Egypt") {
                countryObj = countries.find(c => c.code === "EG");
            }
            if (!countryObj) {
                countryObj = countries.find(c => c.name.toLowerCase().includes(countryName.toLowerCase()));
            }

            let countryCode = "US";
            if (countryObj) {
                countryCode = countryObj.code;
                loc.country = countryObj.name;
                loc.country_code = countryObj.code;
            } else {
                console.warn(`  Could not find country '${countryName}' in reference data. Keeping default.`);
            }

            // B. Fix Industry/Sector & Activity
            const config = companyConfig.find(c => company.name.includes(c.name));
            let keyword = config ? config.keyword : "General";

            let industryName = industries.find(i => i.toLowerCase().includes(keyword.toLowerCase()));
            if (!industryName) {
                if (keyword === "Renewable") industryName = industries.find(i => i.toLowerCase().includes("energy"));
                if (keyword === "Healthcare Services") industryName = industries.find(i => i.toLowerCase().includes("healthcare"));
            }
            if (!industryName) industryName = industries[0];

            // Store industry for later use in QwR
            company._tempIndustry = industryName;

            let acts = await getActivities(industryName);
            if (!acts || acts.length === 0) {
                console.error("  No activities found!");
                continue;
            }

            const activity = acts[0];
            // Update Company Sector
            company.sectors = [{
                id: activity.id,
                name: activity.name
            }];

            // C. Update Assessments (Sync Category)
            const assessment = assessments.find(a => a.evaluated === company.id);
            if (assessment) {
                assessment.data = assessment.data.map(d => ({ ...d, category: activity.id }));
            }
        }

        // 4. Create New Valid Example if not exists (CloudNine)
        const newId = 1011;
        if (!companies.find(c => c.id === newId)) {
            console.log("Creating new example company (CloudNine)...");
            const newLocId = 5011;

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
            newCompany._tempIndustry = newIndustryName; // Store for QwR
            companies.push(newCompany);

            // Add corresponding assessment (Needed for 1:1 mapping)
            const newAssessmentId = 50011;
            assessments.push({
                id: newAssessmentId,
                level: assessments[0].level,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                data: [{ level: 1, category: newAct.id }],
                user: 3011,
                evaluated: newId,
                hash_token: `token${newId}`,
                state: 2,
                from_milestone_planner: false
            });
        }

        // 5. Deduplicate Companies
        const uniqueCompanies = [];
        const map = new Map();
        for (const item of companies) map.set(item.id, item);
        for (const item of map.values()) uniqueCompanies.push(item);
        uniqueCompanies.sort((a, b) => a.id - b.id);

        // 6. Deduplicate Assessments & Ensure 1:1 Mapping
        const uniqueAssessments = [];
        const assessMap = new Map();
        for (const item of assessments) assessMap.set(item.evaluated, item);

        for (const company of uniqueCompanies) {
            let assessment = assessMap.get(company.id);
            if (!assessment) {
                // Try finding by original ID if mismatch or create new
                // Simplified: Just create default if mapping ID not found
                console.log(`Creating missing assessment for company ${company.id}...`);
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
                    user: 3000 + company.id,
                    evaluated: company.id,
                    hash_token: `token${company.id}`,
                    state: 2,
                    from_milestone_planner: false
                };
            }
            // Enforce ID match
            if (assessment.id !== company.id) {
                assessment.id = company.id;
            }
            uniqueAssessments.push(assessment);
        }
        uniqueAssessments.sort((a, b) => a.id - b.id);

        // 7. Rebuild Questions with Responses (QwR) from Scratch
        console.log("Rebuilding Questions and Responses...");
        const questionDefs = [
            { id: 1, text: "Industry", type: "text" },
            { id: 2, text: "HQ Country Code", type: "text" },
            { id: 3, text: "Number of Employees", type: "number" },
            { id: 4, text: "Currency", type: "text" },
            { id: 5, text: "Annual Revenue", type: "number" },
            { id: 6, text: "Revenue Growth", type: "number" },
            { id: 7, text: "Activity Breakdown", type: "json" }
        ];

        const newQwR = questionDefs.map(def => ({
            id: def.id,
            text: def.text,
            answers: [],
            responses: []
        }));

        // Pick 5 valid countries from reference to use in breakdown
        const validCountryCodes = countries.slice(0, 5).map(c => c.code);

        for (const company of uniqueCompanies) {
            const createdAt = company.created_at || new Date().toISOString();
            const config = companyConfig.find(c => company.name.includes(c.name));

            // 1. Industry
            const industryVal = (company.sectors && company.sectors[0]) ? company.sectors[0].name : (config ? config.keyword : "General");
            newQwR[0].responses.push({ // ID 1
                id: 10000 + company.id,
                value: industryVal,
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });

            // 2. HQ Country Code
            // company.locations[0].country_code should be set by now
            const countryCode = (company.locations && company.locations[0]) ? company.locations[0].country_code : "US";

            newQwR[1].responses.push({ // ID 2
                id: 20000 + company.id,
                value: countryCode,
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });

            // 3. Number of Employees
            // Random or fixed
            const employees = Math.floor(Math.random() * 400) + 10; // 10 to 410

            newQwR[2].responses.push({ // ID 3
                id: 30000 + company.id,
                value: employees.toString(),
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });

            // 4. Currency
            const currency = config ? config.currency : DEFAULT_CURRENCY;

            newQwR[3].responses.push({ // ID 4
                id: 40000 + company.id,
                value: currency,
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });

            // 5. Annual Revenue
            const revenue = Math.floor(Math.random() * 1000000) + 50000; // 50k to 1.05M

            newQwR[4].responses.push({ // ID 5
                id: 50000 + company.id,
                value: revenue.toString(),
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });

            // 6. Revenue Growth
            // -0.1 to 0.5
            const growth = (Math.random() * 0.6 - 0.1).toFixed(2);

            newQwR[5].responses.push({ // ID 6
                id: 60000 + company.id,
                value: growth,
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });

            // 7. Activity Breakdown (Complex)
            // Fetch activities for the current company's industry (stored in _tempIndustry)
            const companyIndustryName = company._tempIndustry || (company.sectors && company.sectors[0] ? company.sectors[0].name : "General");
            const acts = await getActivities(companyIndustryName);

            const breakdownItems = [];

            // Use up to 12 activities from the fetched list
            const availableActs = acts.slice(0, 12);
            if (availableActs.length === 0) availableActs.push({ id: 0, name: "General" }); // Fallback if no activities found

            // We want ~60 items total (12 acts * 5 countries) to match the example density
            // If fewer acts, we repeat them.
            const totalItems = 60;
            const weightPerItem = parseFloat((1 / totalItems).toFixed(4)); // approx 0.01666...

            let curActIdx = 0;
            for (let i = 0; i < 12; i++) { // 12 "slots" of activities
                const act = availableActs[curActIdx % availableActs.length];
                curActIdx++;

                for (const code of validCountryCodes) {
                    breakdownItems.push({
                        activityId: act.id,
                        countryCode: code,
                        weight: weightPerItem
                    });
                }
            }

            // Normalize weights explicitly strictly to 1.0 to avoid floating point issues
            const currentSum = breakdownItems.reduce((acc, item) => acc + item.weight, 0);
            const diff = 1.0 - currentSum;
            if (breakdownItems.length > 0) {
                breakdownItems[0].weight += diff; // Dump remainder on first item
            }

            newQwR[6].responses.push({ // ID 7
                id: 70000 + company.id,
                value: JSON.stringify(breakdownItems), // JSON stringified as requested
                user_profile__company_id: company.id,
                company_name: company.name,
                created_at: createdAt
            });
        }

        // 8. Save Files
        fs.writeFileSync(companiesPath, JSON.stringify(uniqueCompanies, null, 4));
        fs.writeFileSync(assessmentsPath, JSON.stringify(uniqueAssessments, null, 4));
        fs.writeFileSync(qwrPath, JSON.stringify(newQwR, null, 4));

        console.log("Successfully updated all data files!");

    } catch (error) {
        console.error("Error in script:", error);
        process.exit(1);
    }
}

main();
