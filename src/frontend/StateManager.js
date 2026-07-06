import {
  REPOSITORIES_INITIAL_VISIBLE_COUNT,
  REPOSITORIES_SHOW_MORE_STEP,
} from './constants.js';

export class StateManager {
  constructor() {
    this.allRepositories = [];
    this.visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
    this.languageColorMap = {};
    this.latestTopTopics = [];
    this.viewState = {
      activeFilter: null,
      activeTopicFilter: null,
      activeSortBy: 'stars',
      activeSortOrder: 'desc',
    };
  }

  normalizeTopicValue(value) {
    return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
  }

  getRepositoryUpdatedTimestamp(repository) {
    if (!repository) {
      return 0;
    }

    const timestamp = repository.pushed_at || repository.updated_at;
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  repositoryHasTopic(repository, topicName) {
    const normalizedTopicName = this.normalizeTopicValue(topicName);
    if (!normalizedTopicName) {
      return false;
    }

    const rawTopics = Array.isArray(repository?.topics) ? repository.topics : [];

    return rawTopics.some((topic) => {
      if (typeof topic === 'string') {
        return this.normalizeTopicValue(topic) === normalizedTopicName;
      }

      if (typeof topic?.name === 'string') {
        return this.normalizeTopicValue(topic.name) === normalizedTopicName;
      }

      return false;
    });
  }

  getProcessedRepositories() {
    const normalizedActiveTopic = this.normalizeTopicValue(this.viewState.activeTopicFilter);

    const topicFilteredRepositories =
      normalizedActiveTopic.length === 0
        ? this.allRepositories.slice()
        : this.allRepositories.filter((repository) => this.repositoryHasTopic(repository, normalizedActiveTopic));

    const filteredRepositories =
      this.viewState.activeFilter == null
        ? topicFilteredRepositories
        : topicFilteredRepositories.filter((repository) => repository?.language === this.viewState.activeFilter);

    const sortedRepositories = filteredRepositories.slice().sort((left, right) => {
      const leftStars = Number(left?.stargazers_count ?? 0);
      const rightStars = Number(right?.stargazers_count ?? 0);
      const leftUpdated = this.getRepositoryUpdatedTimestamp(left);
      const rightUpdated = this.getRepositoryUpdatedTimestamp(right);
      const leftName = String(left?.name ?? '').toLocaleLowerCase();
      const rightName = String(right?.name ?? '').toLocaleLowerCase();
      const direction = this.viewState.activeSortOrder === 'asc' ? 1 : -1;

      let comparison = 0;

      switch (this.viewState.activeSortBy) {
        case 'updated':
          comparison = leftUpdated - rightUpdated;
          break;
        case 'name':
          comparison = leftName.localeCompare(rightName);
          break;
        case 'stars':
        default:
          comparison = leftStars - rightStars;
          break;
      }

      if (comparison !== 0) {
        return comparison * direction;
      }

      return rightStars - leftStars;
    });

    return sortedRepositories;
  }

  setRepositories(repositories) {
    if (Array.isArray(repositories)) {
      this.allRepositories = repositories;
      this.visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
    }
  }

  setLanguageColorMap(nextLanguageColorMap) {
    this.languageColorMap = nextLanguageColorMap ?? {};
  }

  toggleActiveTopicFilter(topicName) {
    const normalizedTopic = this.normalizeTopicValue(topicName);
    if (!normalizedTopic) {
      this.viewState.activeTopicFilter = null;
      return;
    }

    this.viewState.activeTopicFilter = this.viewState.activeTopicFilter === normalizedTopic ? null : normalizedTopic;
  }

  toggleActiveLanguageFilter(language) {
    const normalizedLanguage = typeof language === 'string' ? language : null;
    this.viewState.activeFilter = this.viewState.activeFilter === normalizedLanguage ? null : normalizedLanguage;
  }

  setSortBy(sortBy) {
    this.viewState.activeSortBy = sortBy || 'stars';
  }

  setSortOrder(sortOrder) {
    this.viewState.activeSortOrder = sortOrder || 'desc';
  }

  resetVisibleRepositoriesCount() {
    this.visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
  }

  increaseVisibleRepositoriesCount(maximum) {
    this.visibleRepositoriesCount = Math.min(this.visibleRepositoriesCount + REPOSITORIES_SHOW_MORE_STEP, maximum);
  }

  resetFilteringAndSorting() {
    this.viewState.activeFilter = null;
    this.viewState.activeTopicFilter = null;
    this.viewState.activeSortBy = 'stars';
    this.viewState.activeSortOrder = 'desc';
  }

  clearRepositories() {
    this.allRepositories = [];
    this.visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
  }
}
