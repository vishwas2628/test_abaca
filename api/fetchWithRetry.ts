import originalFetch from 'isomorphic-fetch';
import fetchBuilder from 'fetch-retry-ts';

const fetch = fetchBuilder(originalFetch, {
  retries: 3,
  retryOn: [429, 503, 504, 400, 500],
  retryDelay: (attempt, error, response) => {
    const url = response?.url || error || 'unknown URL';
    const status = response?.status || 'no status';
    console.log(`[Fetch Retry] attempt ${attempt + 1} | URL: ${url} | Status: ${status}`);
    return 1000 * (attempt + 1); // exponential delay
  },
});

export default fetch;
