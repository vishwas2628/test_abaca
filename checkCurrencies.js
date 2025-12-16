require('dotenv').config();

const API_KEY = process.env.VESTED_API_KEY;
const BASE_URL = process.env.VESTED_BASE_URL || 'https://api.vestedimpact.co.uk/v2';
const REF_URL = `${BASE_URL}/reference/currencies`;

async function main() {
    console.log(`Fetching Currencies from: ${REF_URL}`);
    try {
        const response = await fetch(REF_URL, { headers: { 'api-key': API_KEY } });
        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            return;
        }
        const data = await response.json();

        console.log(`Received ${data.length} currencies.`);
        // Assuming data is array of strings or objects. 
        // Based on "Currencies" type usually being string[] or object[], let's inspect.
        if (data.length > 0) {
            console.log("Sample:", JSON.stringify(data.slice(0, 10), null, 2));
        }

    } catch (err) {
        console.error("Fetch error:", err);
    }
}

main();
