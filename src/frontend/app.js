const API_BASE_URL = 'http://127.0.0.1:8000/api/profile';
const form = document.getElementById('profile-search-form');
const usernameInput = document.getElementById('username');
const statusMessage = document.getElementById('status-message');
const emptyState = document.getElementById('profile-empty-state');
const profileCard = document.getElementById('profile-card');
const profileAvatar = document.getElementById('profile-avatar');
const profileLogin = document.getElementById('profile-login');
const profileName = document.getElementById('profile-name');
const profileBio = document.getElementById('profile-bio');
const profileFollowers = document.getElementById('profile-followers');
const profileRepos = document.getElementById('profile-repos');
const profileStars = document.getElementById('profile-stars');
const profileForks = document.getElementById('profile-forks');
const totalPrs = document.getElementById('total-prs');
const profileLink = document.getElementById('profile-link');
const languageChartCanvas = document.getElementById('language-chart');
const topRepositoriesList = document.getElementById('top-repositories-list');
const showMoreRepositoriesButton = document.getElementById('show-more-repositories');
const showLessRepositoriesButton = document.getElementById('show-less-repositories');
const repositoriesSortBySelect = document.getElementById('repositories-sort-by');
const repositoriesSortOrderSelect = document.getElementById('repositories-sort-order');

let languageChart = null;
let allRepositories = [];
let visibleRepositoriesCount = 5;
let statusHideTimeoutId = null;
let languageColorMap = {};
const viewState = {
  activeFilter: null,
  activeSortBy: 'stars',
  activeSortOrder: 'desc',
};

const REPOSITORIES_INITIAL_VISIBLE_COUNT = 5;
const REPOSITORIES_SHOW_MORE_STEP = 10;
const REPOSITORY_TOPICS_MAX_VISIBLE = 6;
const FALLBACK_LANGUAGE_COLOR = '#94a3b8';
const LANGUAGE_CHART_COLORS = ['#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#f472b6', '#fb7185', '#f59e0b'];

function withOpacity(hexColor, opacity) {
  const safeOpacity = Math.max(0, Math.min(1, Number(opacity)));
  const hex = String(hexColor || '').replace('#', '');

  if (hex.length !== 6) {
    return FALLBACK_LANGUAGE_COLOR;
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  if ([red, green, blue].some((value) => Number.isNaN(value))) {
    return FALLBACK_LANGUAGE_COLOR;
  }

  return `rgba(${red}, ${green}, ${blue}, ${safeOpacity})`;
}

function getRepositoryUpdatedTimestamp(repository) {
  if (!repository) {
    return 0;
  }

  const timestamp = repository.pushed_at || repository.updated_at;
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getProcessedRepositories() {
  const filteredRepositories =
    viewState.activeFilter == null
      ? allRepositories.slice()
      : allRepositories.filter((repository) => repository?.language === viewState.activeFilter);

  const sortedRepositories = filteredRepositories.slice().sort((left, right) => {
    const leftStars = Number(left?.stargazers_count ?? 0);
    const rightStars = Number(right?.stargazers_count ?? 0);
    const leftUpdated = getRepositoryUpdatedTimestamp(left);
    const rightUpdated = getRepositoryUpdatedTimestamp(right);
    const leftName = String(left?.name ?? '').toLocaleLowerCase();
    const rightName = String(right?.name ?? '').toLocaleLowerCase();
    const direction = viewState.activeSortOrder === 'asc' ? 1 : -1;

    let comparison = 0;

    switch (viewState.activeSortBy) {
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

function syncSortSelection() {
  if (repositoriesSortBySelect) {
    repositoriesSortBySelect.value = viewState.activeSortBy;
  }

  if (repositoriesSortOrderSelect) {
    repositoriesSortOrderSelect.value = viewState.activeSortOrder;
  }
}

function applyFilterAndSort(resetVisibleCount = false) {
  if (resetVisibleCount) {
    visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
  }

  renderTopRepositories();

  if (languageChart) {
    languageChart.update();
  }
}

function setActiveLanguageFilter(language) {
  const normalizedLanguage = typeof language === 'string' ? language : null;
  viewState.activeFilter = viewState.activeFilter === normalizedLanguage ? null : normalizedLanguage;
  applyFilterAndSort(true);
}

function formatRelativeUpdatedTime(timestamp) {
  if (!timestamp) {
    return null;
  }

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - parsedDate.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (diffMs < minuteMs) {
    return 'Updated just now';
  }

  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  if (diffMs < monthMs) {
    const days = Math.floor(diffMs / dayMs);
    return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
  }

  if (diffMs < yearMs) {
    const months = Math.floor(diffMs / monthMs);
    return `Updated ${months} month${months === 1 ? '' : 's'} ago`;
  }

  const years = Math.floor(diffMs / yearMs);
  return `Updated ${years} year${years === 1 ? '' : 's'} ago`;
}

function showStatus(message, tone = 'info') {
  const toneClasses = {
    info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  };

  if (statusHideTimeoutId) {
    clearTimeout(statusHideTimeoutId);
    statusHideTimeoutId = null;
  }

  statusMessage.className = `mt-6 rounded-2xl border px-4 py-3 text-sm ${toneClasses[tone]}`;
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden');

  if (tone === 'info') {
    statusHideTimeoutId = setTimeout(() => {
      hideStatus();
    }, 4000);
  }
}

function hideStatus() {
  if (statusHideTimeoutId) {
    clearTimeout(statusHideTimeoutId);
    statusHideTimeoutId = null;
  }

  statusMessage.classList.add('hidden');
  statusMessage.textContent = '';
}

function showLoading() {
  emptyState.classList.add('hidden');
  profileCard.classList.remove('hidden');
  profileLogin.textContent = 'Loading...';
  profileName.textContent = 'Analyzing profile';
  profileBio.textContent = 'Fetching the latest public GitHub data.';
  profileFollowers.textContent = '—';
  profileRepos.textContent = '—';
  profileStars.textContent = '—';
  profileForks.textContent = '—';
  if (totalPrs) {
    totalPrs.textContent = '—';
  }
  profileLink.href = '#';
  profileAvatar.removeAttribute('src');
  profileAvatar.alt = 'Loading avatar';
  allRepositories = [];
  visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
  viewState.activeFilter = null;
  viewState.activeSortBy = 'stars';
  viewState.activeSortOrder = 'desc';
  syncSortSelection();
  languageColorMap = renderLanguageChart({});
  renderTopRepositories([], languageColorMap);
}

function renderProfile(profile) {
  emptyState.classList.add('hidden');
  profileCard.classList.remove('hidden');

  profileLogin.textContent = `@${profile.login ?? 'unknown'}`;
  profileName.textContent = profile.name ?? profile.login ?? 'GitHub user';
  profileBio.textContent = profile.bio || 'No bio provided on the public profile.';
  profileFollowers.textContent = Number(profile.followers ?? 0).toLocaleString();
  profileRepos.textContent = Number(profile.public_repos ?? 0).toLocaleString();
  profileLink.href = profile.html_url || `https://github.com/${encodeURIComponent(profile.login ?? '')}`;
  profileLink.textContent = 'View on GitHub';

  if (profile.avatar_url) {
    profileAvatar.src = profile.avatar_url;
  } else {
    profileAvatar.removeAttribute('src');
  }

  profileAvatar.alt = `${profile.name ?? profile.login ?? 'GitHub user'} avatar`;
}

function renderError(message) {
  profileCard.classList.add('hidden');
  emptyState.classList.remove('hidden');
  languageColorMap = renderLanguageChart({});
  allRepositories = [];
  visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
  viewState.activeFilter = null;
  viewState.activeSortBy = 'stars';
  viewState.activeSortOrder = 'desc';
  syncSortSelection();
  renderTopRepositories([], languageColorMap);
  showStatus(message, 'error');
}

function renderAnalyticsError(message) {
  showStatus(message, 'error');
}

function renderLanguageChart(languageCounts) {
  if (!languageChartCanvas) {
    return {};
  }

  if (languageChart) {
    languageChart.destroy();
    languageChart = null;
  }

  const languageEntries = Object.entries(languageCounts ?? {}).filter(([language, count]) => {
    if (typeof language !== 'string') {
      return false;
    }

    const normalizedLanguage = language.trim();
    if (!normalizedLanguage || normalizedLanguage === 'undefined') {
      return false;
    }

    return Number(count) > 0;
  });

  if (!languageEntries.length) {
    const context = languageChartCanvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, languageChartCanvas.width, languageChartCanvas.height);
    }
    return {};
  }

  const labels = languageEntries.map(([language]) => language);
  const values = languageEntries.map(([, count]) => Number(count));
  const total = values.reduce((sum, value) => sum + value, 0);
  const nextLanguageColorMap = labels.reduce((map, language, index) => {
    map[language] = LANGUAGE_CHART_COLORS[index % LANGUAGE_CHART_COLORS.length];
    return map;
  }, {});

  if (viewState.activeFilter && !labels.includes(viewState.activeFilter)) {
    viewState.activeFilter = null;
  }

  languageChart = new Chart(languageChartCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor(context) {
            const language = labels[context.dataIndex];
            const baseColor = nextLanguageColorMap[language] || FALLBACK_LANGUAGE_COLOR;
            if (!viewState.activeFilter || viewState.activeFilter === language) {
              return baseColor;
            }
            return withOpacity(baseColor, 0.25);
          },
          borderColor: '#0f172a',
          borderWidth: 2,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          onClick(_event, legendItem) {
            if (legendItem?.text) {
              setActiveLanguageFilter(legendItem.text);
            }
          },
          labels: {
            color: '#f8fafc',
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            generateLabels(chart) {
              return labels.map((labelText, index) => {
                const baseColor = nextLanguageColorMap[labelText] || FALLBACK_LANGUAGE_COLOR;
                const isActive = !viewState.activeFilter || viewState.activeFilter === labelText;
                const legendTextColor = isActive ? '#f8fafc' : 'rgba(226, 232, 240, 0.55)';
                return {
                  text: labelText,
                  datasetIndex: 0,
                  index,
                  hidden: !chart.getDataVisibility(index),
                  lineCap: 'round',
                  lineDash: [],
                  lineDashOffset: 0,
                  lineJoin: 'round',
                  lineWidth: 0,
                  fillStyle: isActive ? baseColor : withOpacity(baseColor, 0.25),
                  strokeStyle: isActive ? baseColor : withOpacity(baseColor, 0.25),
                  color: legendTextColor,
                  fontColor: legendTextColor,
                  pointStyle: 'circle',
                };
              });
            },
          },
        },
        tooltip: {
          callbacks: {
            label(context) {
              const value = Number(context.raw ?? 0);
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
            },
          },
        },
      },
      onClick(_event, elements) {
        if (!elements?.length || !labels.length) {
          return;
        }

        const selectedIndex = elements[0]?.index;
        const selectedLanguage = labels[selectedIndex];
        if (selectedLanguage) {
          setActiveLanguageFilter(selectedLanguage);
        }
      },
    },
  });

  return nextLanguageColorMap;
}

function renderTopRepositories(repositories, nextLanguageColorMap = languageColorMap) {
  if (!topRepositoriesList) {
    return;
  }

  if (Array.isArray(repositories)) {
    allRepositories = repositories;
    visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
  }

  languageColorMap = nextLanguageColorMap ?? {};

  topRepositoriesList.innerHTML = '';

  const processedRepositories = getProcessedRepositories();
  const items = processedRepositories.slice(0, visibleRepositoriesCount);

  if (!items.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400';
    emptyItem.textContent = 'No repository ranking data available.';
    topRepositoriesList.appendChild(emptyItem);
    if (showMoreRepositoriesButton) {
      showMoreRepositoriesButton.classList.add('hidden');
    }
    if (showLessRepositoriesButton) {
      showLessRepositoriesButton.classList.add('hidden');
    }
    return;
  }

  items.forEach((repository, index) => {
    const item = document.createElement('a');
    item.className =
      'block rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition-colors hover:border-cyan-400/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40';
    item.href = repository.html_url || '#';
    item.target = '_blank';
    item.rel = 'noopener noreferrer';

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between gap-4';

    const titleBlock = document.createElement('div');
    const rank = document.createElement('p');
    rank.className = 'text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200';
    rank.textContent = `#${index + 1}`;

    const name = document.createElement('h4');
    name.className = "mt-1 font-['Space_Grotesk'] text-base font-semibold text-white";
    name.textContent = repository.name || 'Unnamed repository';

    titleBlock.append(rank, name);

    const stars = document.createElement('span');
    stars.className = 'rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200';
    stars.textContent = `${Number(repository.stargazers_count ?? 0).toLocaleString()} stars`;

    header.append(titleBlock, stars);

    const meta = document.createElement('div');
    meta.className = 'mt-3 flex flex-wrap gap-2 text-xs text-slate-400';

    if (repository.language) {
      const language = document.createElement('span');
      language.className = 'inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200';

      const dot = document.createElement('span');
      dot.className = 'mr-2 inline-block h-3 w-3 rounded-full';
      dot.style.backgroundColor = languageColorMap[repository.language] || FALLBACK_LANGUAGE_COLOR;

      const text = document.createElement('span');
      text.textContent = repository.language;

      language.append(dot, text);
      meta.append(language);
    }

    const updatedLabel = formatRelativeUpdatedTime(repository.pushed_at || repository.updated_at);
    if (updatedLabel) {
      const updated = document.createElement('span');
      updated.className = 'text-xs text-gray-400';
      updated.textContent = updatedLabel;
      meta.append(updated);
    }

    const description = document.createElement('p');
    description.className = 'text-sm leading-6 text-slate-300';
    description.textContent = repository.description || 'No description provided.';

    const topics = Array.isArray(repository.topics)
      ? repository.topics
          .filter((topic) => typeof topic === 'string' && topic.trim())
          .slice(0, REPOSITORY_TOPICS_MAX_VISIBLE)
      : [];

    const topicsContainer = document.createElement('div');
    topicsContainer.className = 'mt-3 mb-3 flex flex-wrap gap-2';

    topics.forEach((topic) => {
      const badge = document.createElement('span');
      badge.className =
        'inline-flex items-center rounded-full bg-slate-800/70 px-2 py-1 text-[11px] font-medium text-gray-400';
      badge.textContent = topic;
      topicsContainer.appendChild(badge);
    });

    item.append(header, meta);
    if (topicsContainer.childElementCount > 0) {
      item.appendChild(topicsContainer);
    } else {
      description.classList.add('mt-3');
    }
    item.appendChild(description);
    topRepositoriesList.appendChild(item);
  });

  if (showMoreRepositoriesButton) {
    const shouldShowButton = visibleRepositoriesCount < processedRepositories.length;
    showMoreRepositoriesButton.classList.toggle('hidden', !shouldShowButton);
  }

  if (showLessRepositoriesButton) {
    const shouldShowButton = visibleRepositoriesCount > REPOSITORIES_INITIAL_VISIBLE_COUNT;
    showLessRepositoriesButton.classList.toggle('hidden', !shouldShowButton);
  }
}

function normalizeAnalyticsPayload(payload) {
  const topRepositories =
    (Array.isArray(payload?.top_repositories) && payload.top_repositories) ||
    (Array.isArray(payload?.top_repos) && payload.top_repos) ||
    (Array.isArray(payload?.repositories) && payload.repositories) ||
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

async function fetchProfile(username) {
  const response = await fetch(`${API_BASE_URL}/${encodeURIComponent(username)}`, {
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

async function fetchAnalytics(username) {
  const response = await fetch(`http://127.0.0.1:8000/api/analytics/${encodeURIComponent(username)}`, {
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) {
    renderError('Enter a GitHub username to analyze.');
    return;
  }

  hideStatus();
  showLoading();

  try {
    const profile = await fetchProfile(username);
    renderProfile(profile);

    try {
      const analytics = normalizeAnalyticsPayload(await fetchAnalytics(username));
      profileStars.textContent = analytics.total_stars.toLocaleString();
      profileForks.textContent = analytics.total_forks.toLocaleString();
      if (totalPrs) {
        totalPrs.textContent = analytics.total_prs.toLocaleString();
      }
      languageColorMap = renderLanguageChart(analytics.languages);
      renderTopRepositories(analytics.top_repositories, languageColorMap);
      showStatus(`Loaded profile for ${profile.login ?? username}.`, 'info');
    } catch (error) {
      profileStars.textContent = '—';
      profileForks.textContent = '—';
      if (totalPrs) {
        totalPrs.textContent = '—';
      }
      languageColorMap = renderLanguageChart({});
      allRepositories = [];
      visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
      renderTopRepositories([], languageColorMap);

      if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
        renderAnalyticsError(error.message);
      } else {
        showStatus(
          `Loaded profile for ${profile.login ?? username}, but the analytics view could not be loaded.`,
          'info',
        );
      }
    }
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'The profile request failed.');
  }
});

if (showMoreRepositoriesButton) {
  showMoreRepositoriesButton.addEventListener('click', () => {
    const processedRepositories = getProcessedRepositories();
    visibleRepositoriesCount = Math.min(
      visibleRepositoriesCount + REPOSITORIES_SHOW_MORE_STEP,
      processedRepositories.length,
    );
    renderTopRepositories();
  });
}

if (showLessRepositoriesButton) {
  showLessRepositoriesButton.addEventListener('click', () => {
    visibleRepositoriesCount = REPOSITORIES_INITIAL_VISIBLE_COUNT;
    renderTopRepositories();
  });
}

if (repositoriesSortBySelect) {
  repositoriesSortBySelect.addEventListener('change', (event) => {
    viewState.activeSortBy = event.target.value || 'stars';
    applyFilterAndSort(true);
  });
}

if (repositoriesSortOrderSelect) {
  repositoriesSortOrderSelect.addEventListener('change', (event) => {
    viewState.activeSortOrder = event.target.value || 'desc';
    applyFilterAndSort(true);
  });
}
