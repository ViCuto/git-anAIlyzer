export class AppController {
  constructor(apiService, stateManager, uiManager, elements) {
    this.apiService = apiService;
    this.stateManager = stateManager;
    this.uiManager = uiManager;
    this.elements = elements;
  }

  normalizeAnalyticsPayload(payload) {
    const topRepositories =
      (Array.isArray(payload?.repositories) && payload.repositories) ||
      (Array.isArray(payload?.top_repositories) && payload.top_repositories) ||
      (Array.isArray(payload?.top_repos) && payload.top_repos) ||
      (Array.isArray(payload?.topRepositories) && payload.topRepositories) ||
      [];

    const languages =
      (payload?.languages && typeof payload.languages === 'object' && payload.languages) ||
      (payload?.language_counts && typeof payload.language_counts === 'object' && payload.language_counts) ||
      {};

    return {
      total_stars: Number(payload?.total_stars ?? 0),
      total_forks: Number(payload?.total_forks ?? 0),
      total_prs: Number(payload?.total_prs ?? payload?.pull_requests ?? 0),
      languages,
      top_repositories: topRepositories,
    };
  }

  applyFilterAndSort(resetVisibleCount = false) {
    if (resetVisibleCount) {
      this.stateManager.resetVisibleRepositoriesCount();
    }

    this.uiManager.renderTopRepositories();
    this.uiManager.updateLanguageChart();
  }

  setActiveTopicFilter(topicName) {
    const normalizedTopic = this.stateManager.normalizeTopicValue(topicName);

    if (!normalizedTopic) {
      this.stateManager.viewState.activeTopicFilter = null;
      this.applyFilterAndSort(true);
      return;
    }

    this.stateManager.toggleActiveTopicFilter(topicName);
    this.stateManager.resetVisibleRepositoriesCount();
    this.uiManager.renderCoreTechnologies(this.stateManager.latestTopTopics);
    this.applyFilterAndSort(true);
  }

  setActiveLanguageFilter(language) {
    this.stateManager.toggleActiveLanguageFilter(language);
    this.applyFilterAndSort(true);
  }

  resetAnalyticsPresentation() {
    this.stateManager.clearRepositories();
    this.stateManager.resetFilteringAndSorting();
    this.uiManager.syncSortSelection();

    const nextLanguageColorMap = this.uiManager.renderLanguageChart({});
    this.stateManager.setLanguageColorMap(nextLanguageColorMap);

    this.uiManager.renderCoreTechnologies([]);
    this.uiManager.renderTopRepositories([], this.stateManager.languageColorMap);
  }

  async onSubmit(event) {
    event.preventDefault();

    const username = this.elements.usernameInput.value.trim();
    if (!username) {
      this.uiManager.renderErrorState();
      this.resetAnalyticsPresentation();
      this.uiManager.showStatus('Enter a GitHub username to analyze.', 'error');
      return;
    }

    this.uiManager.hideStatus();
    this.uiManager.showLoading();
    this.resetAnalyticsPresentation();

    try {
      const profile = await this.apiService.fetchProfile(username);
      this.uiManager.renderProfile(profile);

      try {
        const analytics = this.normalizeAnalyticsPayload(await this.apiService.fetchAnalytics(username));

        this.elements.profileStars.textContent = this.uiManager.formatCompactNumber(analytics.total_stars);
        this.elements.profileForks.textContent = this.uiManager.formatCompactNumber(analytics.total_forks);

        if (this.elements.totalPrs) {
          this.elements.totalPrs.textContent = this.uiManager.formatCompactNumber(analytics.total_prs);
        }

        const nextLanguageColorMap = this.uiManager.renderLanguageChart(analytics.languages);
        this.stateManager.setLanguageColorMap(nextLanguageColorMap);
        this.uiManager.renderTopRepositories(analytics.top_repositories, this.stateManager.languageColorMap);
        this.uiManager.showStatus(`Loaded profile for ${profile.login ?? username}.`, 'info');
      } catch (error) {
        this.elements.profileStars.textContent = '—';
        this.elements.profileForks.textContent = '—';

        if (this.elements.totalPrs) {
          this.elements.totalPrs.textContent = '—';
        }

        const nextLanguageColorMap = this.uiManager.renderLanguageChart({});
        this.stateManager.clearRepositories();
        this.stateManager.setLanguageColorMap(nextLanguageColorMap);
        this.uiManager.renderTopRepositories([], this.stateManager.languageColorMap);

        if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
          this.uiManager.showStatus(error.message, 'error');
        } else {
          this.uiManager.showStatus(
            `Loaded profile for ${profile.login ?? username}, but the analytics view could not be loaded.`,
            'info',
          );
        }
      }
    } catch (error) {
      this.uiManager.renderErrorState();
      this.resetAnalyticsPresentation();
      this.uiManager.showStatus(error instanceof Error ? error.message : 'The profile request failed.', 'error');
    }
  }

  onShowMoreRepositories() {
    const processedRepositories = this.stateManager.getProcessedRepositories();
    this.stateManager.increaseVisibleRepositoriesCount(processedRepositories.length);
    this.uiManager.renderTopRepositories();
  }

  onShowLessRepositories() {
    this.stateManager.resetVisibleRepositoriesCount();
    this.uiManager.renderTopRepositories();
  }

  onSortByChange(event) {
    this.stateManager.setSortBy(event.target.value);
    this.applyFilterAndSort(true);
  }

  onSortOrderChange(event) {
    this.stateManager.setSortOrder(event.target.value);
    this.applyFilterAndSort(true);
  }

  bindEvents() {
    this.elements.form.addEventListener('submit', (event) => {
      this.onSubmit(event);
    });

    if (this.elements.showMoreRepositoriesButton) {
      this.elements.showMoreRepositoriesButton.addEventListener('click', () => {
        this.onShowMoreRepositories();
      });
    }

    if (this.elements.showLessRepositoriesButton) {
      this.elements.showLessRepositoriesButton.addEventListener('click', () => {
        this.onShowLessRepositories();
      });
    }

    if (this.elements.repositoriesSortBySelect) {
      this.elements.repositoriesSortBySelect.addEventListener('change', (event) => {
        this.onSortByChange(event);
      });
    }

    if (this.elements.repositoriesSortOrderSelect) {
      this.elements.repositoriesSortOrderSelect.addEventListener('change', (event) => {
        this.onSortOrderChange(event);
      });
    }
  }
}
