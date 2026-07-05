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
const profileLink = document.getElementById('profile-link');

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
  showStatus(message, 'error');
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
    showStatus(`Loaded profile for ${profile.login ?? username}.`, 'info');
  } catch (error) {
    renderError(error instanceof Error ? error.message : 'The profile request failed.');
  }
});
