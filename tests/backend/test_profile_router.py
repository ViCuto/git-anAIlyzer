from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.clients import GitHubNotFoundError, GitHubProfileRequest, GitHubProfileResponse, GitHubRateLimitError
from backend.routers.profile import router


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


@pytest.fixture()
def profile_payload() -> GitHubProfileResponse:
    return GitHubProfileResponse(
        login="octocat",
        name="The Octocat",
        avatar_url="https://example.com/avatar.png",
        bio="demo",
        followers=12,
        public_repos=8,
        html_url="https://github.com/octocat",
    )


def test_get_profile_returns_profile_data(
    client: TestClient,
    mocker: pytest.MockFixture,
    profile_payload: GitHubProfileResponse,
) -> None:
    # Arrange
    mock_fetch_user_profile = mocker.patch(
        "backend.routers.profile.fetch_user_profile",
        return_value=profile_payload,
    )

    # Act
    response = client.get("/api/profile/octocat")

    # Assert
    assert response.status_code == 200
    assert response.json() == {
        "login": "octocat",
        "name": "The Octocat",
        "avatar_url": "https://example.com/avatar.png",
        "bio": "demo",
        "followers": 12,
        "public_repos": 8,
        "html_url": "https://github.com/octocat",
    }
    mock_fetch_user_profile.assert_called_once_with(GitHubProfileRequest(username="octocat"))


def test_get_profile_translates_missing_user_to_404(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch_user_profile = mocker.patch(
        "backend.routers.profile.fetch_user_profile",
        side_effect=GitHubNotFoundError("GitHub user 'missing' not found"),
    )

    # Act
    response = client.get("/api/profile/missing")

    # Assert
    assert response.status_code == 404
    assert response.json() == {"detail": "GitHub user 'missing' not found"}
    mock_fetch_user_profile.assert_called_once_with(GitHubProfileRequest(username="missing"))


def test_get_profile_translates_rate_limit_to_429(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mocker.patch(
        "backend.routers.profile.fetch_user_profile",
        side_effect=GitHubRateLimitError("GitHub API rate limit exceeded"),
    )

    # Act
    response = client.get("/api/profile/octocat")

    # Assert
    assert response.status_code == 429
    assert response.json() == {"detail": "GitHub API rate limit exceeded"}


def test_get_profile_translates_upstream_errors_to_502(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mocker.patch(
        "backend.routers.profile.fetch_user_profile",
        side_effect=httpx.ReadTimeout("upstream timeout"),
    )

    # Act
    response = client.get("/api/profile/octocat")

    # Assert
    assert response.status_code == 502
    assert response.json() == {"detail": "Failed to fetch GitHub profile"}


def test_get_profile_rejects_blank_username(
    client: TestClient,
    mocker: pytest.MockFixture,
) -> None:
    # Arrange
    mock_fetch_user_profile = mocker.patch("backend.routers.profile.fetch_user_profile")

    # Act
    response = client.get("/api/profile/%20%20%20")

    # Assert
    assert response.status_code == 400
    assert response.json() == {"detail": "username must not be empty"}
    mock_fetch_user_profile.assert_not_called()