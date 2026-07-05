from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.clients import GitHubNotFoundError, GitHubRateLimitError
from backend.routers.languages import router


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def test_get_languages_returns_language_counts(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch_user_language_stats = mocker.patch(
        "backend.routers.languages.fetch_user_language_stats",
        return_value={"Python": 2, "JavaScript": 1},
    )

    # Act
    response = client.get("/api/languages/%20octocat%20")

    # Assert
    assert response.status_code == 200
    assert response.json() == {"Python": 2, "JavaScript": 1}
    mock_fetch_user_language_stats.assert_called_once_with("octocat")


def test_get_languages_translates_missing_user_to_404(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch_user_language_stats = mocker.patch(
        "backend.routers.languages.fetch_user_language_stats",
        side_effect=GitHubNotFoundError("GitHub user 'missing' not found"),
    )

    # Act
    response = client.get("/api/languages/missing")

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "GitHub user 'missing' not found"}
    mock_fetch_user_language_stats.assert_called_once_with("missing")


def test_get_languages_translates_rate_limit_to_429(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mocker.patch(
        "backend.routers.languages.fetch_user_language_stats",
        side_effect=GitHubRateLimitError("GitHub API rate limit exceeded"),
    )

    # Act
    response = client.get("/api/languages/octocat")

    # Assert
    assert response.status_code == 429
    assert response.json() == {"detail": "GitHub API rate limit exceeded"}


def test_get_languages_translates_value_error_to_400(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch_user_language_stats = mocker.patch(
        "backend.routers.languages.fetch_user_language_stats",
        side_effect=ValueError("username must not be empty"),
    )

    # Act
    response = client.get("/api/languages/octocat")

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "username must not be empty"}
    mock_fetch_user_language_stats.assert_called_once_with("octocat")


def test_get_languages_rejects_blank_username(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch_user_language_stats = mocker.patch("backend.routers.languages.fetch_user_language_stats")

    # Act
    response = client.get("/api/languages/%20%20%20")

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "username must not be empty"}
    mock_fetch_user_language_stats.assert_not_called()