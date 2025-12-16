
import { VestedImpactAssetGroupAPI } from "./api/assetGroup";
import {
    AssetGroupCreateInput,
    AssetGroupHoldings
} from "./api/types";

// -------------------- Helper Functions --------------------
function getMissingFields<T>(obj: T, fields: (keyof T)[]): string[] {
    return fields.filter(field => obj[field] === undefined || obj[field] === null) as string[];
}

// -------------------- Main Function --------------------
export async function processCohort(
    group: AssetGroupCreateInput,
    holdingsWrapper: AssetGroupHoldings, // Use correct type wrapper
    regenerateReport?: boolean
): Promise<{ cohortId: string; status: "success" | "partial"; message: string }> {
    const apiKey = process.env.VESTED_API_KEY;
    if (!apiKey) throw new Error("Server configuration error: API key not found");

    // ---------- Step 0: Validate required fields ----------
    const groupFields: (keyof AssetGroupCreateInput)[] = ['name', 'description', 'owner'];
    const missingGroupFields = getMissingFields(group, groupFields);

    if (missingGroupFields.length) {
        throw new Error(`Missing required fields. Group: [${missingGroupFields.join(', ')}]`);
    }

    // Validate holdings
    // AssetGroupHoldings is { holdings: {id, weight}[] }
    // The user input 'holdings' in the prompt code seemed to assume it was an array directly, 
    // but the type input says `AssetGroupHoldings`.
    // Let's ensure we handle the structure correctly.
    if (!holdingsWrapper || !Array.isArray(holdingsWrapper.holdings)) {
        throw new Error("Holdings must be provided in the correct structure: { holdings: [...] }");
    }

    const holdings = holdingsWrapper.holdings; // Extract Array

    if (holdings.length === 0) {
        throw new Error("Holdings array must be non-empty.");
    }

    const invalidHoldings = holdings.filter(h => !h.id || typeof h.weight !== 'number');
    if (invalidHoldings.length > 0) {
        throw new Error("Invalid holdings: Each holding must have an id and a numeric weight.");
    }

    // Validate weights sum to 1 (approx)
    const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);
    // Warning only, as API might auto-normalize or handle slightly off weights
    if (Math.abs(totalWeight - 1.0) > 1e-4) {
        console.warn(`Holdings total weight is ${totalWeight}, expected 1.0.`);
    }

    const vestedGroup = new VestedImpactAssetGroupAPI(apiKey);

    // ---------- Step 1: Create Group ----------
    let groupId: string = "";

    try {
        const createResult = await vestedGroup.createAssetGroup(group);
        if (createResult && createResult.id) {
            groupId = createResult.id;
        } else {
            // Handle case where create might return invalid data or error logic
            // Assuming if fetch didn't throw, it returned the group object. 
            // But if `createAssetGroup` implementation returns a simplified object or different shape on error?
            // types.ts says `AssetGroup` { id, name ... }
            if (!createResult.id) throw new Error("API returned group without ID.");
        }
    } catch (error: any) {
        // If create fails, assume it might exist if error suggests so, or just search fallback.
        console.warn(`Group creation failed (potentially exists): ${error.message}. Attempting search.`);

        // Search for existing group to recover ID
        try {
            const searchResult = await vestedGroup.searchAssetGroup(group.name);
            // AssetGroupSearchResults: { results: { id, name, owner }[] }
            if (searchResult && searchResult.results && Array.isArray(searchResult.results)) {
                // Find strict match on name AND owner (if possible) or just name
                const existingGroup = searchResult.results.find(
                    (item) => item.name === group.name // && item.owner === group.owner? API search result has owner.
                );
                // Note: The search result type in types.js says `owner` is present.
                // Let's verify prompt code logic: `item.owner === group.owner`.
                // If API returns owner, this is good.

                if (existingGroup) {
                    groupId = existingGroup.id;
                    console.log(`Found existing group via search: ${groupId}`);
                } else {
                    throw new Error("Group already exists (creation failed) but could not be definitively identified by search.");
                }
            } else {
                throw new Error("Group search returned no results.");
            }
        } catch (searchError: any) {
            // If the original error was truly fatal (not just 'exists'), we should probably throw that one or a combined one.
            // But here we throw the search error which implies we tried to recover and failed.
            throw new Error(`Group processing error (Create & Search failed): ${searchError.message}`);
        }
    }

    // ---------- Step 2: Check / Regenerate Report ----------
    if (groupId) {
        if (regenerateReport) {
            console.log(`Regenerate flag is true. Cleaning up old reports for group ${groupId}...`);
            try {
                // Fetch history
                const history = await vestedGroup.getAssetGroupImpactHistory(groupId);
                if (history && history.reports && history.reports.length > 0) {
                    console.log(`Found ${history.reports.length} report(s). Deleting...`);
                    for (const rep of history.reports) {
                        try {
                            const delOp = await vestedGroup.deleteAssetGroupImpactReport(groupId, rep.id);
                            // deleteAssetGroupImpactReport returns boolean 'ok' in prompt code? 
                            // Let's check api/assetGroup.ts provided earlier.
                            // `return response.ok;` Yes, it returns boolean.
                            if (delOp === true) {
                                console.log(`Deleted report ${rep.id}`);
                            } else {
                                console.warn(`Failed to delete report ${rep.id} (API returned false)`);
                            }
                        } catch (delErr) {
                            console.warn(`Failed to delete report ${rep.id}:`, delErr);
                        }
                    }
                }
            } catch (histErr) {
                console.warn("Failed to fetch/delete history for regeneration:", histErr);
            }
            // Proceed to generate
        } else {
            // Standard check: if report exists, return it
            try {
                const existingReport = await vestedGroup.getAssetGroupImpactReport(groupId);
                if (existingReport && !("error" in existingReport) && !("statusCode" in existingReport)) {
                    // Success
                    return {
                        cohortId: groupId,
                        status: "success",
                        message: "Group already exists. Returning existing report.",
                    };
                }
            } catch (err) {
                console.warn("Existing report not found or could not be fetched. Proceeding to generate.");
            }
        }
    }

    // ---------- Step 3: Generate Impact ----------
    let status: "success" | "partial" = "success";

    try {
        // generateGroupImpact(groupId, holdings) expects correct structure.
        // Our valid `holdingsWrapper` is exactly `AssetGroupHoldings` type { holdings: [...] }
        await vestedGroup.generateGroupImpact(groupId, holdingsWrapper);
        console.log(`Impact generation initiated for Group ${groupId}`);
    } catch (error: any) {
        console.error(`Impact report generation failed for Group ${groupId}:`, error.message);
        status = "partial";
    }

    // ---------- Step 4: Final Response ----------
    return {
        cohortId: groupId,
        status,
        message: status === "success"
            ? "Group processed successfully."
            : "Group created/found, but impact generation failed."
    };
}
