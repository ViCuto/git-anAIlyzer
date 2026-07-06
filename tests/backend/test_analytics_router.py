from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.clients import GitHubNotFoundError, GitHubRateLimitError, GitHubRepositoryAnalyticsResponse
from backend.routers.analytics import router


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture()
def analytics_payload() -> GitHubRepositoryAnalyticsResponse:
    return GitHubRepositoryAnalyticsResponse(
        total_stars=58,
        total_forks=19,
        total_prs=44,
        languages={"Python": 3, "JavaScript": 1, "Go": 1},
        top_repos=[
            {
                "name": "repo-c",
                "description": None,
                "html_url": "https://github.com/octocat/repo-c",
                "stargazers_count": 25,
                "language": "Python",
                "pushed_at": "2026-07-01T12:00:00Z",
            },
            {
                "name": "repo-f",
                "description": "sixth repo",
                "html_url": "https://github.com/octocat/repo-f",
                "stargazers_count": 12,
                "language": "Python",
                "pushed_at": "2026-06-30T08:30:00Z",
            },
        ],
    )


def test_get_analytics_returns_aggregated_repo_data(
    client: TestClient,
    mocker: pytest.MockFixture,
    analytics_payload: GitHubRepositoryAnalyticsResponse,
) -> None:
    # Arrange
    mock_fetch = mocker.patch(
        "backend.routers.analytics.fetch_user_repos_analytics",
        return_value=analytics_payload,
    )

    # Act
    response = client.get("/api/analytics/octocat")

    # Assert
    assert response.status_code == 200
    assert response.json() == {
        "total_stars": 58,
        "total_forks": 19,
        "total_prs": 44,
        "languages": {"Python": 3, "JavaScript": 1, "Go": 1},
        "top_repos": [
            {
                "name": "repo-c",
                "description": None,
                "html_url": "https://github.com/octocat/repo-c",
                "stargazers_count": 25,
                "language": "Python",
                "pushed_at": "2026-07-01T12:00:00Z",
            },
            {
                "name": "repo-f",
                "description": "sixth repo",
                "html_url": "https://github.com/octocat/repo-f",
                "stargazers_count": 12,
                "language": "Python",
                "pushed_at": "2026-06-30T08:30:00Z",
            },
        ],
    }
    mock_fetch.assert_called_once_with("octocat")


def test_get_analytics_translates_missing_user_to_404(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch = mocker.patch(
        "backend.routers.analytics.fetch_user_repos_analytics",
        side_effect=GitHubNotFoundError("GitHub user 'missing' not found"),
    )

    # Act
    response = client.get("/api/analytics/missing")

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "GitHub user 'missing' not found"}
    mock_fetch.assert_called_once_with("missing")


def test_get_analytics_translates_rate_limit_to_429(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mocker.patch(
        "backend.routers.analytics.fetch_user_repos_analytics",
        side_effect=GitHubRateLimitError("GitHub API rate limit exceeded"),
    )

    # Act
    response = client.get("/api/analytics/octocat")

    # Assert
    assert response.status_code == 429
    assert response.json() == {"detail": "GitHub API rate limit exceeded"}


def test_get_analytics_translates_upstream_errors_to_502(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mocker.patch(
        "backend.routers.analytics.fetch_user_repos_analytics",
        side_effect=httpx.ReadTimeout("upstream timeout"),
    )

    # Act
    response = client.get("/api/analytics/octocat")

    # Assert
    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to fetch GitHub analytics"}


def test_get_analytics_rejects_blank_username(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch = mocker.patch("backend.routers.analytics.fetch_user_repos_analytics")

    # Act
    response = client.get("/api/analytics/%20%20%20")

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "username must not be empty"}
    mock_fetch.assert_not_called()