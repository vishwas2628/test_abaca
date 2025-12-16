import { Asset, AssetBasics, AssetBreakdown, AssetCreateInput, AssetCreateResponse, AssetImpact, AssetImpactHistory, AssetSearchResults, ImpactCalculationStatus, deleteAsset, deleteAssetImpactReport } from './types';
import fetch from "./fetchWithRetry"

const delay1Second = () => new Promise((resolve) => setTimeout(resolve, 1000));

/**
 * An example class demonstrating use cases for the Vested Impact data API using fetch.
 * This class focusses on asset operations
 * 
 * @param apiKey Your Vested Impact API key.
 */
export default class VestedImpactAssetAPI {
  private readonly apiUrl = 'https://api.vestedimpact.co.uk/v2/asset';

  constructor(private readonly apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Create a new asset and return the asset and suggested activities based on the description and industry.
   * We can also check here for duplicates to avoid confusion in future
   */
  async createAsset(asset: AssetCreateInput) {
    /* Check for duplicate assets */
    const searchResponse = await fetch(
      `${this.apiUrl}/search/name/${asset.name}`,
      {
        headers: { 'api-key': this.apiKey },
        method: 'GET',
        retries: 5,
        retryDelay: (attempt) => 1000 * attempt,
      },

    );
    const searchResults = (await searchResponse.json()) as AssetSearchResults;
    const existing = searchResults.results.find((item) => item.industry === asset.industry && item.name === asset.name);
    if (existing) {
      /* The asset already exists, we should use this one instead! */
      return {
        success: false,
        message: `Asset already exists`
      };
    }
    /* Create a new asset */
    // console.log(asset)
    const createResponse = await fetch(
      this.apiUrl,
      {
        body: JSON.stringify(asset),
        headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
    return (await createResponse.json()) as AssetCreateResponse;
  }

  /**
   * Update all asset properties and schedule impact calculation.
   */
  async generateAssetImpact(assetId: string, basics: AssetBasics, breakdown: AssetBreakdown) {
    /* Set asset basics */
    await fetch(
      `${this.apiUrl}/id/${assetId}/basics`,
      {
        body: JSON.stringify(basics),
        headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
        method: 'PUT',
      },
    );
    /* Set asset breakdown */
    await fetch(
      `${this.apiUrl}/id/${assetId}/breakdown`,
      {
        body: JSON.stringify(breakdown),
        headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
        method: 'PUT',
      },
    );
    /* Schedule calculation of the assets impact data */
    await fetch(
      `${this.apiUrl}/id/${assetId}/impact/calculate`,
      { headers: { 'api-key': this.apiKey }, method: 'POST' },
    );
    /* Wait for the calculation to complete */
    let calculationStatus = 'UNKNOWN';
    while (!['COMPLETED', 'FAILED'].includes(calculationStatus)) {
      await delay1Second();
      const statusResponse = await fetch(
        `${this.apiUrl}/id/${assetId}/impact/status`,
        { headers: { 'api-key': this.apiKey }, method: 'GET' },
      );
      calculationStatus = ((await statusResponse.json()) as ImpactCalculationStatus).status;
    }
    if (calculationStatus !== 'COMPLETED') {
      /* Handle error in calculation, likely due to missing or misconfigured basics/breakdown data */
      throw new Error(`Impact calculation failed for asset ${assetId}`);
    }
  }

  /**
   * Fetch asset data.
   */
  async getAsset(assetId: string) {
    const response = await fetch(
      `${this.apiUrl}/id/${assetId}`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as Asset;
  }

  /**
   * Fetch impact history for an asset.
   * This includes the id of each impact report which can be used to retrieve the full report data.
   */
  async getAssetImpactHistory(assetId: string) {
    const response = await fetch(
      `${this.apiUrl}/id/${assetId}/impact/history`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as AssetImpactHistory;
  }

  /**
   * Fetch impact data for an asset.
   * If the reportId is provided a specific report from the assets history will be returned.
   * Else the most recent data will be returned.
   */
  async getAssetImpactReport(assetId: string, reportId?: string) {
    const response = await fetch(
      reportId ? `${this.apiUrl}/id/${assetId}/impact/id/${reportId}` : `${this.apiUrl}/id/${assetId}/impact/current`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as AssetImpact;
  }

  /**
   * Search for an asset by name.
   * This can be used to ensure we don't create duplicate assets.
   */
  async searchAsset(nameQuery: string) {
    const response = await fetch(
      `${this.apiUrl}/search/name/${nameQuery}`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as AssetSearchResults;
  }

  /**
  * Delete an asset by its ID.
  */
  async deleteAsset(assetId: string) {
    const response = await fetch(
      `${this.apiUrl}/id/${assetId}`,
      { headers: { 'api-key': this.apiKey }, method: 'DELETE' },
    );
    return response.ok; // returns true if deleted successfully
  }

  /**
   * Delete a specific impact report of an asset by reportId.
   */
  async deleteAssetImpactReport(assetId: string, reportId: string) {
    const response = await fetch(
      `${this.apiUrl}/id/${assetId}/impact/id/${reportId}`,
      { headers: { 'api-key': this.apiKey }, method: 'DELETE' },
    );
    return response; // returns true if deleted successfully
  }

}

