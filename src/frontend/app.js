const API_BASE_URL = 'http://127.0.0.1:8000/api/profile';
const LANGUAGE_API_BASE_URL = 'http://127.0.0.1:8000/api/languages';

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
const profileLink = document.getElementById('profile-link');
const languageChartCanvas = document.getElementById('language-chart');

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
  profileLink.href = '#';
  profileAvatar.removeAttribute('src');
  profileAvatar.alt = 'Loading avatar';
  renderLanguageChart({});
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

async function fetchLanguageStats(username) {
  const response = await fetch(`${LANGUAGE_API_BASE_URL}/${encodeURIComponent(username)}`, {
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
    throw new Error(detail || `No language data found for ${username}.`);
  }

  if (response.status === 400) {
    throw new Error(detail || 'Enter a valid GitHub username.');
  }

  throw new Error(detail || 'The language data request failed. Try again in a moment.');
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
      const languageStats = await fetchLanguageStats(username);
      renderLanguageChart(languageStats);
      showStatus(`Loaded profile for ${profile.login ?? username}.`, 'info');
    } catch {
      renderLanguageChart({});
      showStatus(
        `Loaded profile for ${profile.login ?? username}, but the language chart could not be loaded.`,
        'info',
      );
    }
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'The profile request failed.');
  }
});
