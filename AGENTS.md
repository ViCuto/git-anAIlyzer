# Git-AnAIlyzer

Developer analytics and profile dashboards generated on the fly.

## Vision / What this project is

Git-AnAIlyzer is a lightweight, real-time web application that acts as a dynamic GitHub profile dashboard. It is designed to fetch public developer statistics and repository data directly from the GitHub REST API and present them instantly in a visually engaging interface.

This project intentionally avoids heavy persistence, authentication, and framework complexity. The experience should feel stateless, fast, and polished, with a strong emphasis on immediate feedback and clean data presentation.

## Capabilities / Product scope

The application must let users:

1. Search: Enter any valid GitHub username into a clean interface.
2. Profile Overview: View the user's avatar, bio, follower count, and total public repositories.
3. Aggregated Stats: See the total sum of stars and forks collected across all of the user's public repositories.
4. Visualizations: View the distribution of programming languages used across their repositories through an interactive pie or doughnut chart.
5. Top Repositories: Review a ranked display of the user's top 5 most starred repositories.
6. Error Handling: Receive graceful error messages or visual indicators if a username does not exist (HTTP 404) or if the API rate limit is exceeded.

## What this project is NOT

- Not a database-backed analytics platform.
- Not a multi-user platform with authentication.
- Not a heavy Single Page Application (SPA).

## Working in this repository (CRITICAL RULES FOR AGENTS)

Agents and contributors must treat the following as fixed product truths:

1. Tech Stack Boundaries: The backend is Python (FastAPI). The frontend is pure HTML, CSS, and Vanilla JS. Do not introduce heavy frameworks like React or Angular, and do not introduce ORMs like SQLAlchemy.
2. Mandatory Mocking Rule: When generating automated tests, agents must use mocking for all HTTP requests made to the GitHub API. Use tools such as `unittest.mock`, `responses`, or `respx` to isolate tests. Automated tests must never make real network calls to `api.github.com` to avoid rate limits during CI/CD or local execution.

## Architecture & Core Subsystems

### Web / Routing Layer (FastAPI)

This layer owns the HTTP interface, request validation, response shaping, and route orchestration. It should expose endpoints that receive a GitHub username, coordinate the fetch-and-aggregate flow, and return structured data for the UI. It must not contain presentation logic or direct chart rendering.

### Data Processing & API Client Layer (Python)

This layer owns all communication with the GitHub REST API and all data transformation. It is responsible for fetching raw JSON, handling missing or partial fields, detecting rate-limit and not-found cases, and performing the core mathematical aggregation such as summing stars and forks and grouping repositories by language.

### UI / Visualization Layer (HTML/JS/Chart.js)

This layer is strictly responsible for rendering the data returned by the backend. It may manage DOM updates, loading states, error presentation, and Chart.js visualizations, but it must not fetch GitHub data directly or duplicate backend aggregation logic.