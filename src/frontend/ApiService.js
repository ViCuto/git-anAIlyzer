export class ApiService {
  constructor(profileBaseUrl, analyticsBaseUrl) {
    this.profileBaseUrl = profileBaseUrl;
    this.analyticsBaseUrl = analyticsBaseUrl;
  }

  async fetchProfile(username) {
    const response = await fetch(`${this.profileBaseUrl}/${encodeURIComponent(username)}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return response.json();
    }

    const errorPayload = await response.json().catch(() => null);
    const detail = errorPayload?.detail;

    if (response.status === 404) {
      throw new Error(detail || `No GitHub profile found for ${username}.`);
    }

    if (response.status === 400) {
      throw new Error(detail || 'Enter a valid GitHub username.');
    }

    throw new Error(detail || 'The profile request failed. Try again in a moment.');
  }

  async fetchAnalytics(username) {
    const response = await fetch(`${this.analyticsBaseUrl}/${encodeURIComponent(username)}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      return response.json();
    }

    const errorPayload = await response.json().catch(() => null);
    const detail = errorPayload?.detail;

    if (response.status === 429) {
      throw new Error(detail || 'GitHub rate limit exceeded. Try again in a few minutes.');
    }

    if (response.status === 404) {
      throw new Error(detail || `No analytics data found for ${username}.`);
    }

    if (response.status === 400) {
      throw new Error(detail || 'Enter a valid GitHub username.');
    }

    throw new Error(detail || 'The analytics request failed. Try again in a moment.');
  }
}
