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
const profileLink = document.getElementById('profile-link');
const languageChartCanvas = document.getElementById('language-chart');
const topRepositoriesList = document.getElementById('top-repositories-list');

let languageChart = null;

function showStatus(message, tone = 'info') {
  const toneClasses = {
    info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  };

  statusMessage.className = `mt-6 rounded-2xl border px-4 py-3 text-sm ${toneClasses[tone]}`;
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden');
}

function hideStatus() {
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
  profileLink.href = '#';
  profileAvatar.removeAttribute('src');
  profileAvatar.alt = 'Loading avatar';
  renderLanguageChart({});
  renderTopRepositories([]);
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
  renderLanguageChart({});
  renderTopRepositories([]);
  showStatus(message, 'error');
}

function renderAnalyticsError(message) {
  showStatus(message, 'error');
}

function renderLanguageChart(languageCounts) {
  if (!languageChartCanvas) {
    return;
  }

  if (languageChart) {
    languageChart.destroy();
    languageChart = null;
  }

  const languageEntries = Object.entries(languageCounts ?? {}).filter(([, count]) => Number(count) > 0);

  if (!languageEntries.length) {
    const context = languageChartCanvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, languageChartCanvas.width, languageChartCanvas.height);
    }
    return;
  }

  const labels = languageEntries.map(([language]) => language);
  const values = languageEntries.map(([, count]) => Number(count));
  const total = values.reduce((sum, value) => sum + value, 0);
  const backgroundColors = [
    '#22d3ee',
    '#38bdf8',
    '#60a5fa',
    '#818cf8',
    '#a78bfa',
    '#f472b6',
    '#fb7185',
    '#f59e0b',
  ];

  languageChart = new Chart(languageChartCanvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, index) => backgroundColors[index % backgroundColors.length]),
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
          labels: {
            color: '#cbd5e1',
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
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
    },
  });
}

function renderTopRepositories(repositories) {
  if (!topRepositoriesList) {
    return;
  }

  topRepositoriesList.innerHTML = '';

  const items = Array.isArray(repositories) ? repositories.slice(0, 5) : [];

  if (!items.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400';
    emptyItem.textContent = 'No repository ranking data available.';
    topRepositoriesList.appendChild(emptyItem);
    return;
  }

  items.forEach((repository, index) => {
    const item = document.createElement('li');
    item.className = 'rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-cyan-400/30 hover:bg-slate-950/70';

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
      language.className = 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1';
      language.textContent = repository.language;
      meta.append(language);
    }

    const forks = document.createElement('span');
    forks.className = 'rounded-full border border-white/10 bg-white/5 px-2.5 py-1';
    forks.textContent = `${Number(repository.forks_count ?? 0).toLocaleString()} forks`;
    meta.append(forks);

    const description = document.createElement('p');
    description.className = 'mt-3 text-sm leading-6 text-slate-300';
    description.textContent = repository.description || 'No description provided.';

    item.append(header, meta, description);
    topRepositoriesList.appendChild(item);
  });
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
      renderLanguageChart(analytics.languages);
      renderTopRepositories(analytics.top_repositories);
      showStatus(`Loaded profile for ${profile.login ?? username}.`, 'info');
    } catch (error) {
      profileStars.textContent = '—';
      profileForks.textContent = '—';
      renderLanguageChart({});
      renderTopRepositories([]);

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
