import { AssetBasics, AssetBreakdown, AssetGroupCreateInput, AssetGroupHoldings } from './api/types';

const key = process.env.ABACA_API_TOKEN!;
const url = process.env.ABACA_BASE_URL!; // keep trailing slash

export async function formattedAbacaData(abacaId: string): Promise<{ basics: AssetBasics; breakdown: AssetBreakdown }> {
    try {
        const [companyRes, assessmentsRes, matchingRes] = await Promise.all([
            fetch(`${url}companies/${abacaId}/`, {
                headers: { authorization: key },
            }),
            fetch(`${url}companies/${abacaId}/assessments/`, {
                headers: { authorization: key },
            }),
            fetch(`${url}matching/questions-with-responses/${abacaId}`, {
                headers: { authorization: key },
            }),
        ]);

        if (!companyRes.ok) throw new Error(`Company fetch failed: ${companyRes.status}`);
        if (!assessmentsRes.ok) throw new Error(`Assessments fetch failed: ${assessmentsRes.status}`);
        if (!matchingRes.ok) throw new Error(`Matching fetch failed: ${matchingRes.status}`);

        const company = await companyRes.json();
        // const assessments = await assessmentsRes.json(); // Not currently used but fetched
        const matchingQuestions = await matchingRes.json();

        const getValue = (questionId: number) => {
            const q = matchingQuestions.find((x: any) => x.id === questionId);
            return q?.responses?.[0]?.value;
        };

        // Attempt to resolve Industry and Country from company data or questions
        // Fallback strings are used if data is missing, but consider throwing if critical data is absent.
        const industry = company.sectors?.[0]?.name || "General";
        const country = company.locations?.[0]?.country_code || "US";

        let breakdownItems: AssetBreakdown['breakdown'] = [];
        const rawBreakdown = getValue(2005);
        if (rawBreakdown) {
            try {
                const parsed = JSON.parse(rawBreakdown);
                if (Array.isArray(parsed)) {
                    breakdownItems = parsed.map((item: any) => ({
                        activityId: Number(item.activityId),
                        countryCode: item.countryCode || country,
                        weight: Number(item.weight) || 1
                    }));
                }
            } catch (e) {
                console.warn(`Failed to parse breakdown for company ${abacaId}`, e);
            }
        }

        const basics: AssetBasics = {
            currency: getValue(2002) || "USD",
            revenue: Number(getValue(2003)) || 0,
            revenueGrowth: Number(getValue(2004)) || 0,
            description: company.about || "",
            hqCountryCode: country,
            industry: industry,
            name: company.name || "Unknown Company",
            numEmployees: Number(getValue(2001)) || 0,
        };

        return {
            basics,
            breakdown: { breakdown: breakdownItems },
        };
    } catch (err) {
        console.error("Error fetching formatted Abaca data:", err);
        throw err;
    }
}

export async function formattedAbacaCohortData(uid: string): Promise<{ group: AssetGroupCreateInput; holdings: AssetGroupHoldings }> {
    try {
        const cohortRes = await fetch(
            `${url}user/company-lists/${uid}/companies`,
            {
                headers: { authorization: key },
            }
        );

        if (!cohortRes.ok) {
            throw new Error(`Cohort fetch failed: ${cohortRes.status}`);
        }

        const data = await cohortRes.json();

        if (!data.group || !data.holdings) {
            throw new Error("Invalid cohort response structure");
        }

        const group: AssetGroupCreateInput = {
            description: data.group.description || "",
            name: data.group.name || "Default Asset Group",
            owner: data.group.owner || "Abaca Group Owner",
        };

        const holdings: AssetGroupHoldings = {
            holdings: data.holdings.map((h: any) => ({
                id: String(h.id),
                // type: h.type, // API expects just id and weight in AssetGroupHoldings?
                // Check api/types.ts: AssetGroupHoldings = { holdings: { id: string, weight: number }[] }
                weight: Number(h.weight) || 0,
            }))
        };

        return {
            group,
            holdings,
        };
    } catch (err) {
        console.error("Error fetching formatted Abaca cohort data:", err);
        throw err;
    }
}
