
import VestedImpactAssetAPI from "./api/asset";
import {
    AssetCreateInput,
    AssetBasics,
    AssetBreakdownItem,
} from "./api/types";

// -------------------- Helper Functions --------------------
function getMissingFields<T>(obj: T, fields: (keyof T)[]): string[] {
    return fields.filter(field => obj[field] === undefined || obj[field] === null) as string[];
}

function validateBreakdown(
    breakdown: AssetBreakdownItem[],
    suggestedActivities: any[],
    hqCountryCode: string,
): AssetBreakdownItem[] {
    // Scenario 1: No provided breakdown, but we have suggestions. Distribute evenly.
    if (breakdown.length === 0 && suggestedActivities.length > 0) {
        const numActivities = Math.min(3, suggestedActivities.length);
        return suggestedActivities.slice(0, numActivities).map((act: any) => ({
            activityId: act.id,
            countryCode: hqCountryCode,
            weight: 1.0 / numActivities
        }));
    }

    // Scenario 2: Provided breakdown, validate and fix activity IDs using suggestions.
    if (breakdown.length > 0 && suggestedActivities.length > 0) {
        const validIds = new Set(suggestedActivities.map((act: any) => act.id));
        return breakdown.map((item: AssetBreakdownItem) => {
            // If the provided activityId isn't in the suggested list, fallback to the first suggested one.
            if (!validIds.has(item.activityId)) {
                console.warn(`Invalid activityId ${item.activityId}; using first suggested ID: ${suggestedActivities[0]?.id}`);
                return { ...item, activityId: suggestedActivities[0].id };
            }
            return item;
        });
    }

    // Scenario 3: Provided breakdown, no suggestions. Trust the input (or warn).
    if (breakdown.length > 0 && suggestedActivities.length === 0) {
        console.warn("Warning: No suggested activities available to validate activityIds; responding with provided breakdown.");
        return breakdown;
    }

    return breakdown;
}

// -------------------- Main Function --------------------
export async function processAsset(
    asset: AssetCreateInput,
    basics: AssetBasics,
    breakdown?: AssetBreakdownItem[],
    regenerateReport?: boolean
): Promise<{ assetUUID: string; status: "success" | "partial"; message: string }> {
    const apiKey = process.env.VESTED_API_KEY;
    if (!apiKey) throw new Error("Server configuration error: API key not found");

    // ---------- Step 0: Validate required fields ----------
    const assetFields: (keyof AssetCreateInput)[] = ['description', 'hqCountryCode', 'industry', 'name', 'numEmployees'];
    const basicsFields: (keyof AssetBasics)[] = ['currency', 'revenue', 'revenueGrowth', 'description', 'hqCountryCode', 'industry', 'name', 'numEmployees'];

    const missingAssetFields = getMissingFields(asset, assetFields);
    const missingBasicsFields = getMissingFields(basics, basicsFields);

    if (missingAssetFields.length || missingBasicsFields.length) {
        throw new Error(`Missing required fields. Asset: [${missingAssetFields.join(', ')}]. Basics: [${missingBasicsFields.join(', ')}]`);
    }

    const numericFields: (keyof AssetBasics)[] = ['revenue', 'revenueGrowth', 'numEmployees'];
    const invalidNumbers = numericFields.filter(f => typeof basics[f] !== 'number');
    if (invalidNumbers.length > 0) throw new Error(`Fields must be numbers: [${invalidNumbers.join(', ')}]`);

    const vested = new VestedImpactAssetAPI(apiKey);

    // ---------- Step 1: Create asset ----------
    let assetId: string = "";
    let suggestedActivities: any[] = [];
    try {
        const createResult = await vested.createAsset(asset);

        // Check if creation was successful and returned an asset
        if ("asset" in createResult && createResult.asset?.id) {
            assetId = createResult.asset.id;
            suggestedActivities = createResult.suggestedActivities || [];
        } else if ("message" in createResult) {
            // Handle "Asset already exists" or other messages
            if (createResult.message === "Asset already exists") {
                // Search to find the existing asset ID
                const searchResult = await vested.searchAsset(asset.name);
                const existingAsset = searchResult.results.find(
                    (item) => item.industry === asset.industry && item.name === asset.name
                );

                if (!existingAsset) {
                    throw new Error(`Asset creation failed: Asset already exists but could not be retrieved via search.`);
                }

                assetId = existingAsset.id;
                console.warn(`Asset already exists (ID: ${assetId}).`);

                // Handle Regeneration Logic
                if (regenerateReport) {
                    console.log(`Regenerate flag is true. Cleaning up old reports for asset ${assetId}...`);
                    try {
                        const history = await vested.getAssetImpactHistory(assetId);
                        if (history && history.reports && history.reports.length > 0) {
                            console.log(`Found ${history.reports.length} report(s). Deleting...`);
                            for (const rep of history.reports) {
                                try {
                                    const delRes = await vested.deleteAssetImpactReport(assetId, rep.id);
                                    // Check response.ok since deleteAssetImpactReport returns the Fetch Response
                                    if (!delRes.ok) {
                                        console.warn(`Failed to delete report ${rep.id}, status: ${delRes.status}`);
                                    } else {
                                        console.log(`Deleted report ${rep.id}`);
                                    }
                                } catch (delErr) {
                                    console.warn(`Error deleting report ${rep.id}:`, delErr);
                                }
                            }
                        }
                    } catch (histErr) {
                        console.warn("Failed to fetch/delete history for regeneration:", histErr);
                    }
                } else {
                    // Check if a report already exists to return early
                    try {
                        const existingReport = await vested.getAssetImpactReport(assetId);
                        // Verify if it's a valid report (basic check)
                        if (existingReport && !("statusCode" in existingReport) && !("error" in existingReport)) {
                            return {
                                assetUUID: assetId,
                                status: "success",
                                message: "Asset already exists. Returning existing report."
                            };
                        }
                    } catch (err) {
                        console.warn("Existing report not found or could not be fetched. Proceeding to generate.");
                    }
                }
            } else {
                throw new Error(`Asset creation returned message: ${createResult.message}`);
            }
        } else {
            throw new Error("Asset creation failed: Unexpected response format.");
        }
    } catch (error: any) {
        throw new Error(`Asset processing error during creation: ${error.message || error}`);
    }

    // ---------- Step 2: Validate Breakdown ----------
    let finalBreakdown: AssetBreakdownItem[] = [];
    try {
        finalBreakdown = validateBreakdown(breakdown || [], suggestedActivities, basics.hqCountryCode);
    } catch (error: any) {
        throw new Error(`Breakdown validation error: ${error.message}`);
    }

    // Validate Breakdown Consistency (Weights sum to 1.0)
    if (finalBreakdown.length > 0) {
        const isValid = finalBreakdown.every((item: AssetBreakdownItem) =>
            typeof item.activityId === 'number' &&
            typeof item.countryCode === 'string' && item.countryCode.length === 2 &&
            typeof item.weight === 'number' && item.weight >= 0
        );

        const totalWeight = finalBreakdown.reduce(
            (sum: number, item: AssetBreakdownItem) => sum + item.weight,
            0
        );

        if (!isValid) {
            throw new Error("Breakdown items missing required attributes (activityId, countryCode, weight).");
        }
        if (Math.abs(totalWeight - 1.0) > 1e-4) { // slightly looser tolerance
            console.warn(`Breakdown weights sum to ${totalWeight}, normalizing...`);
            // Normalize
            finalBreakdown = finalBreakdown.map(b => ({ ...b, weight: b.weight / totalWeight }));
        }
    } else {
        console.warn("No breakdown items provided or generated.");
    }

    // ---------- Step 3: Generate Impact ----------
    let status: "success" | "partial" = "success";
    try {
        await vested.generateAssetImpact(assetId, basics, { breakdown: finalBreakdown });
        console.log(`Impact report generation initiated/completed for ${assetId}.`);
    } catch (error: any) {
        status = "partial";
        console.error(`Impact report generation failed for ${assetId}:`, error);
        // We return partial success because the asset exists/was created, but report failed.
    }

    // ---------- Step 4: Return Response ----------
    return {
        assetUUID: assetId,
        status,
        message: status === "success"
            ? "Asset processed and report generated successfully."
            : `Asset created/found (ID: ${assetId}), but report generation failed.`
    };
}
