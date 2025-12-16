import { Activities, Countries, Currencies, Industries, Regions } from './types';
import fetch from './fetchWithRetry';

/**
 * An example class demonstrating use cases for the Vested Impact data API using fetch.
 * This class focusses on reference data operations
 * 
 * @param apiKey Your Vested Impact API key.
 */
export class VestedImpactReferenceAPI {
  private readonly apiUrl = 'https://api.vestedimpact.co.uk/v2/reference';

  constructor(private readonly apiKey: string) { 
    this.apiKey = apiKey;
  }

  /**
   * Fetch a list of all activities within a given industry.
   * When providing asset activity information one of these activities must be used.
   * The industry passed to this endpoint should be one of the available industries from the associated endpoint.
   */
  async fetchActivitiesWithinIndustry(industry: string) {
    const response = await fetch(
      `${this.apiUrl}/activities/industry/${industry}`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as Activities;
  }

  /**
   * Fetch a list of all countries.
   * When creating or updating assets the countries from this list must be used.
   */
  async fetchCountries() {
    const response = await fetch(
      `${this.apiUrl}/countries`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as Countries;
  }

  /**
   * Fetch a list of all currencies.
   * When providing asset financial information one of these currencies must be used.
   */
  async fetchCurrencies() {
    const response = await fetch(
      `${this.apiUrl}/currencies`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as Currencies;
  }

  /**
   * Fetch a list of all industries.
   * When providing asset industry information one of these industries must be used.
   */
  async fetchIndustries() {
    const response = await fetch(
      `${this.apiUrl}/industries`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as Industries;
  }

  /**
   * Fetch a list of geographic regions and the countries contained within them.
   * When creating or updating assets the countries from this list must be used.
   */
  async fetchRegions() {
    const response = await fetch(
      `${this.apiUrl}/regions`,
      { headers: { 'api-key': this.apiKey }, method: 'GET' },
    );
    return (await response.json()) as Regions;
  }
}
