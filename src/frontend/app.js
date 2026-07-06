import { ApiService } from './ApiService.js';
import { AppController } from './AppController.js';
import { StateManager } from './StateManager.js';
import { UIManager } from './UIManager.js';
import { API_ANALYTICS_URL, API_BASE_URL } from './constants.js';

const elements = {
  form: document.getElementById('profile-search-form'),
  usernameInput: document.getElementById('username'),
  statusMessage: document.getElementById('status-message'),
  emptyState: document.getElementById('profile-empty-state'),
  profileCard: document.getElementById('profile-card'),
  profileAvatar: document.getElementById('profile-avatar'),
  profileLogin: document.getElementById('profile-login'),
  profileName: document.getElementById('profile-name'),
  profileBio: document.getElementById('profile-bio'),
  profileFollowers: document.getElementById('profile-followers'),
  profileRepos: document.getElementById('profile-repos'),
  profileStars: document.getElementById('profile-stars'),
  profileForks: document.getElementById('profile-forks'),
  totalPrs: document.getElementById('total-prs'),
  profileLink: document.getElementById('profile-link'),
  languageChartCanvas: document.getElementById('language-chart'),
  coreTechnologiesCloud: document.getElementById('core-technologies-cloud'),
  topRepositoriesList: document.getElementById('top-repositories-list'),
  showMoreRepositoriesButton: document.getElementById('show-more-repositories'),
  showLessRepositoriesButton: document.getElementById('show-less-repositories'),
  repositoriesSortBySelect: document.getElementById('repositories-sort-by'),
  repositoriesSortOrderSelect: document.getElementById('repositories-sort-order'),
};

const stateManager = new StateManager();
let appController = null;

const uiManager = new UIManager(elements, stateManager, {
  onTopicFilter: (topicName) => {
    if (appController) {
      appController.setActiveTopicFilter(topicName);
    }
  },
  onLanguageFilter: (language) => {
    if (appController) {
      appController.setActiveLanguageFilter(language);
    }
  },
});

const apiService = new ApiService(API_BASE_URL, API_ANALYTICS_URL);
appController = new AppController(apiService, stateManager, uiManager, elements);
appController.bindEvents();
