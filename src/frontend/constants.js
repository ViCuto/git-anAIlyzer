export const API_BASE_URL = 'http://127.0.0.1:8000/api/profile';
export const API_ANALYTICS_URL = 'http://127.0.0.1:8000/api/analytics';

export const REPOSITORIES_INITIAL_VISIBLE_COUNT = 5;
export const REPOSITORIES_SHOW_MORE_STEP = 10;
export const REPOSITORY_TOPICS_MAX_VISIBLE = 6;
export const FALLBACK_LANGUAGE_COLOR = '#94a3b8';
export const LANGUAGE_CHART_COLORS = [
  '#22d3ee',
  '#38bdf8',
  '#60a5fa',
  '#818cf8',
  '#a78bfa',
  '#f472b6',
  '#fb7185',
  '#f59e0b',
];

export const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
