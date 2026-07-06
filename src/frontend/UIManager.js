import {
  FALLBACK_LANGUAGE_COLOR,
  LANGUAGE_CHART_COLORS,
  REPOSITORIES_INITIAL_VISIBLE_COUNT,
  REPOSITORY_TOPICS_MAX_VISIBLE,
  compactNumberFormatter,
} from './constants.js';

export class UIManager {
  constructor(elements, state, callbacks) {
    this.elements = elements;
    this.state = state;
    this.callbacks = callbacks;
    this.languageChart = null;
    this.statusHideTimeoutId = null;
  }

  withOpacity(hexColor, opacity) {
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

  formatCompactNumber(value) {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return '0';
    }

    return compactNumberFormatter.format(numericValue);
  }

  formatRelativeUpdatedTime(timestamp) {
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

  showStatus(message, tone = 'info') {
    const toneClasses = {
      info: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
      error: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    };

    if (this.statusHideTimeoutId) {
      clearTimeout(this.statusHideTimeoutId);
      this.statusHideTimeoutId = null;
    }

    this.elements.statusMessage.className = `mt-6 rounded-2xl border px-4 py-3 text-sm ${toneClasses[tone]}`;
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.classList.remove('hidden');

    if (tone === 'info') {
      this.statusHideTimeoutId = setTimeout(() => {
        this.hideStatus();
      }, 4000);
    }
  }

  hideStatus() {
    if (this.statusHideTimeoutId) {
      clearTimeout(this.statusHideTimeoutId);
      this.statusHideTimeoutId = null;
    }

    this.elements.statusMessage.classList.add('hidden');
    this.elements.statusMessage.textContent = '';
  }

  syncSortSelection() {
    if (this.elements.repositoriesSortBySelect) {
      this.elements.repositoriesSortBySelect.value = this.state.viewState.activeSortBy;
    }

    if (this.elements.repositoriesSortOrderSelect) {
      this.elements.repositoriesSortOrderSelect.value = this.state.viewState.activeSortOrder;
    }
  }

  showLoading() {
    this.elements.emptyState.classList.add('hidden');
    this.elements.profileCard.classList.remove('hidden');
    this.elements.profileLogin.textContent = 'Loading...';
    this.elements.profileName.textContent = 'Analyzing profile';
    this.elements.profileBio.textContent = 'Fetching the latest public GitHub data.';
    this.elements.profileFollowers.textContent = '—';
    this.elements.profileRepos.textContent = '—';
    this.elements.profileStars.textContent = '—';
    this.elements.profileForks.textContent = '—';

    if (this.elements.totalPrs) {
      this.elements.totalPrs.textContent = '—';
    }

    this.elements.profileLink.href = '#';
    this.elements.profileAvatar.removeAttribute('src');
    this.elements.profileAvatar.alt = 'Loading avatar';
  }

  renderProfile(profile) {
    this.elements.emptyState.classList.add('hidden');
    this.elements.profileCard.classList.remove('hidden');

    this.elements.profileLogin.textContent = `@${profile.login ?? 'unknown'}`;
    this.elements.profileName.textContent = profile.name ?? profile.login ?? 'GitHub user';
    this.elements.profileBio.textContent = profile.bio || 'No bio provided on the public profile.';
    this.elements.profileFollowers.textContent = this.formatCompactNumber(profile.followers ?? 0);
    this.elements.profileRepos.textContent = this.formatCompactNumber(profile.public_repos ?? 0);
    this.elements.profileLink.href = profile.html_url || `https://github.com/${encodeURIComponent(profile.login ?? '')}`;
    this.elements.profileLink.textContent = 'View on GitHub';

    if (profile.avatar_url) {
      this.elements.profileAvatar.src = profile.avatar_url;
    } else {
      this.elements.profileAvatar.removeAttribute('src');
    }

    this.elements.profileAvatar.alt = `${profile.name ?? profile.login ?? 'GitHub user'} avatar`;
    this.renderCoreTechnologies(profile.top_topics);
  }

  renderErrorState() {
    this.elements.profileCard.classList.add('hidden');
    this.elements.emptyState.classList.remove('hidden');
  }

  normalizeTopTopics(topics) {
    if (!Array.isArray(topics)) {
      return [];
    }

    return topics
      .map((topic) => {
        const name = typeof topic?.name === 'string' ? topic.name.trim() : '';
        const count = Number(topic?.count ?? 0);

        if (!name || !Number.isFinite(count) || count <= 0) {
          return null;
        }

        return { name, count };
      })
      .filter((topic) => topic !== null);
  }

  renderCoreTechnologies(topics) {
    if (!this.elements.coreTechnologiesCloud) {
      return;
    }

    this.elements.coreTechnologiesCloud.innerHTML = '';
    const normalizedTopics = this.normalizeTopTopics(topics);
    this.state.latestTopTopics = normalizedTopics;

    if (!normalizedTopics.length) {
      const emptyText = document.createElement('p');
      emptyText.className = 'text-sm text-slate-400';
      emptyText.textContent = 'No topic data available yet.';
      this.elements.coreTechnologiesCloud.appendChild(emptyText);
      return;
    }

    const maxCount = Math.max(...normalizedTopics.map((topic) => topic.count));
    const minCount = Math.min(...normalizedTopics.map((topic) => topic.count));
    const countRange = Math.max(1, maxCount - minCount);

    normalizedTopics.forEach((topic) => {
      const ratio = (topic.count - minCount) / countRange;
      const alpha = 0.18 + ratio * 0.2;
      const borderAlpha = 0.28 + ratio * 0.25;
      const fontSize = 12 + ratio * 2;
      const isActive =
        this.state.normalizeTopicValue(this.state.viewState.activeTopicFilter) ===
        this.state.normalizeTopicValue(topic.name);

      const badge = document.createElement('button');
      badge.type = 'button';
      badge.className = `inline-flex cursor-pointer items-center rounded-full px-3 py-1.5 font-semibold tracking-wide text-cyan-50 shadow-inner transition-colors hover:bg-slate-700 ${
        isActive ? 'ring-1 ring-cyan-200/60' : ''
      }`;
      badge.style.backgroundColor = isActive
        ? 'rgba(71, 85, 105, 0.82)'
        : `rgba(6, 182, 212, ${alpha.toFixed(3)})`;
      badge.style.border = isActive
        ? '1px solid rgba(186, 230, 253, 0.75)'
        : `1px solid rgba(34, 211, 238, ${borderAlpha.toFixed(3)})`;
      badge.style.fontSize = `${fontSize.toFixed(1)}px`;

      const topicName = document.createElement('span');
      topicName.textContent = topic.name;

      const topicCount = document.createElement('span');
      topicCount.className = 'ml-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-100';
      topicCount.textContent = topic.count.toLocaleString();

      badge.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      badge.addEventListener('click', () => {
        this.callbacks.onTopicFilter(topic.name);
      });

      badge.append(topicName, topicCount);
      this.elements.coreTechnologiesCloud.appendChild(badge);
    });
  }

  renderLanguageChart(languageCounts) {
    if (!this.elements.languageChartCanvas) {
      return {};
    }

    if (this.languageChart) {
      this.languageChart.destroy();
      this.languageChart = null;
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
      const context = this.elements.languageChartCanvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, this.elements.languageChartCanvas.width, this.elements.languageChartCanvas.height);
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

    if (this.state.viewState.activeFilter && !labels.includes(this.state.viewState.activeFilter)) {
      this.state.viewState.activeFilter = null;
    }

    this.languageChart = new Chart(this.elements.languageChartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: (context) => {
              const language = labels[context.dataIndex];
              const baseColor = nextLanguageColorMap[language] || FALLBACK_LANGUAGE_COLOR;
              if (!this.state.viewState.activeFilter || this.state.viewState.activeFilter === language) {
                return baseColor;
              }
              return this.withOpacity(baseColor, 0.25);
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
            onClick: (_event, legendItem) => {
              if (legendItem?.text) {
                this.callbacks.onLanguageFilter(legendItem.text);
              }
            },
            labels: {
              color: '#f8fafc',
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              generateLabels: (chart) => {
                return labels.map((labelText, index) => {
                  const baseColor = nextLanguageColorMap[labelText] || FALLBACK_LANGUAGE_COLOR;
                  const isActive =
                    !this.state.viewState.activeFilter || this.state.viewState.activeFilter === labelText;
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
                    fillStyle: isActive ? baseColor : this.withOpacity(baseColor, 0.25),
                    strokeStyle: isActive ? baseColor : this.withOpacity(baseColor, 0.25),
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
        onClick: (_event, elements) => {
          if (!elements?.length || !labels.length) {
            return;
          }

          const selectedIndex = elements[0]?.index;
          const selectedLanguage = labels[selectedIndex];
          if (selectedLanguage) {
            this.callbacks.onLanguageFilter(selectedLanguage);
          }
        },
      },
    });

    return nextLanguageColorMap;
  }

  renderTopRepositories(repositories, nextLanguageColorMap = this.state.languageColorMap) {
    if (!this.elements.topRepositoriesList) {
      return;
    }

    if (Array.isArray(repositories)) {
      this.state.setRepositories(repositories);
    }

    this.state.setLanguageColorMap(nextLanguageColorMap);
    this.elements.topRepositoriesList.innerHTML = '';

    const processedRepositories = this.state.getProcessedRepositories();
    const items = processedRepositories.slice(0, this.state.visibleRepositoriesCount);

    if (!items.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400';
      emptyItem.textContent = 'No repository ranking data available.';
      this.elements.topRepositoriesList.appendChild(emptyItem);

      if (this.elements.showMoreRepositoriesButton) {
        this.elements.showMoreRepositoriesButton.classList.add('hidden');
      }

      if (this.elements.showLessRepositoriesButton) {
        this.elements.showLessRepositoriesButton.classList.add('hidden');
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
      meta.className = 'mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400';

      if (repository.language) {
        const language = document.createElement('span');
        language.className = 'inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-200';

        const dot = document.createElement('span');
        dot.className = 'mr-2 inline-block h-3 w-3 rounded-full';
        dot.style.backgroundColor = this.state.languageColorMap[repository.language] || FALLBACK_LANGUAGE_COLOR;

        const text = document.createElement('span');
        text.textContent = repository.language;

        language.append(dot, text);
        meta.append(language);
      }

      const updatedLabel = this.formatRelativeUpdatedTime(repository.pushed_at || repository.updated_at);
      if (updatedLabel) {
        const updated = document.createElement('span');
        updated.className = 'inline-flex items-center text-xs text-gray-400';
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
      topicsContainer.className = 'mt-3 mb-3 flex items-center flex-wrap gap-1';

      if (topics.length > 0) {
        const topicsIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        topicsIcon.setAttribute('viewBox', '0 0 24 24');
        topicsIcon.setAttribute('fill', 'none');
        topicsIcon.setAttribute('stroke', 'currentColor');
        topicsIcon.setAttribute('stroke-width', '1.7');
        topicsIcon.setAttribute('class', 'h-3.5 w-3.5 text-gray-500');
        topicsIcon.setAttribute('aria-hidden', 'true');

        const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        iconPath.setAttribute('stroke-linecap', 'round');
        iconPath.setAttribute('stroke-linejoin', 'round');
        iconPath.setAttribute(
          'd',
          'm20.59 13.41-7.18 7.18a2 2 0 0 1-2.83 0l-7.18-7.18V4h9.41l7.18 7.18a2 2 0 0 1 0 2.83Z',
        );

        const iconCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        iconCircle.setAttribute('cx', '8.5');
        iconCircle.setAttribute('cy', '8.5');
        iconCircle.setAttribute('r', '1.5');
        iconCircle.setAttribute('fill', 'currentColor');
        iconCircle.setAttribute('stroke', 'none');

        topicsIcon.append(iconPath, iconCircle);
        topicsContainer.appendChild(topicsIcon);
      }

      topics.forEach((topic) => {
        const badge = document.createElement('span');
        badge.className =
          'inline-flex items-center rounded-full border border-gray-700/40 bg-transparent px-2 py-1 text-[11px] font-medium text-gray-400';
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
      this.elements.topRepositoriesList.appendChild(item);
    });

    if (this.elements.showMoreRepositoriesButton) {
      const shouldShowButton = this.state.visibleRepositoriesCount < processedRepositories.length;
      this.elements.showMoreRepositoriesButton.classList.toggle('hidden', !shouldShowButton);
    }

    if (this.elements.showLessRepositoriesButton) {
      const shouldShowButton = this.state.visibleRepositoriesCount > REPOSITORIES_INITIAL_VISIBLE_COUNT;
      this.elements.showLessRepositoriesButton.classList.toggle('hidden', !shouldShowButton);
    }
  }

  updateLanguageChart() {
    if (this.languageChart) {
      this.languageChart.update();
    }
  }
}
