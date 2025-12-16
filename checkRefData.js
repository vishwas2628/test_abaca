require('dotenv').config();

const API_KEY = process.env.VESTED_API_KEY;
const BASE_URL = process.env.VESTED_BASE_URL || 'https://api.vestedimpact.co.uk/v2';
const REF_URL = `${BASE_URL}/reference`;

async function checkEndpoint(name) {
    const url = `${REF_URL}/${name}`;
    console.log(`\nFetching ${name}: ${url}`);
    try {
        const response = await fetch(url, { headers: { 'api-key': API_KEY } });
        console.log(`Status: ${response.status}`);
        if (!response.ok) return;

        const data = await response.json();
        const snippet = JSON.stringify(data).substring(0, 200);
        console.log(`Data Type: ${Array.isArray(data) ? 'Array' : typeof data}`);
        console.log(`Data Count: ${Array.isArray(data) ? data.length : 'N/A'}`);
        console.log(`Preview: ${snippet}...`);

        if (name === 'countries' && Array.isArray(data)) {
            // Check for currency info in country objects
            const c = data[0];
            console.log("Country Sample:", JSON.stringify(c, null, 2));
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

async function main() {
    await checkEndpoint('countries');
    await checkEndpoint('currencies');
    await checkEndpoint('industries');
}

main();
