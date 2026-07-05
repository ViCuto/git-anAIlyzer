import pytest

from backend.clients.github import (
    GitHubNotFoundError,
    GitHubProfileRequest,
    fetch_user_language_stats,
    fetch_user_profile,
)


@pytest.fixture()
def github_profile_payload() -> dict[str, object]:
    return {
        "login": "octocat",
        "name": "The Octocat",
        "avatar_url": "https://example.com/avatar.png",
        "bio": "demo",
        "followers": 12,
        "public_repos": 8,
        "html_url": "https://github.com/octocat",
    }


@pytest.mark.asyncio
async def test_fetch_user_profile_returns_basic_profile_data(
    mocker: pytest.MockFixture,
    github_profile_payload: dict[str, object],
) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = github_profile_payload
    mock_response.raise_for_status.return_value = None
    mock_get = mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)
    request = GitHubProfileRequest(username=" octocat ")

    # Act
    profile = await fetch_user_profile(request)

    # Assert
    assert profile.login == "octocat"
    assert profile.name == "The Octocat"
    assert profile.avatar_url == "https://example.com/avatar.png"
    assert profile.bio == "demo"
    assert profile.followers == 12
    assert profile.public_repos == 8
    assert profile.html_url == "https://github.com/octocat"
    mock_get.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_user_profile_translates_404_to_domain_error(mocker: pytest.MockFixture) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 404
    mock_response.json.return_value = {}
    mock_response.raise_for_status.return_value = None
    mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)
    request = GitHubProfileRequest(username="missing")

    # Act / Assert
    with pytest.raises(GitHubNotFoundError, match="GitHub user 'missing' not found"):
        await fetch_user_profile(request)


@pytest.mark.asyncio
async def test_fetch_user_profile_rejects_blank_username() -> None:
    # Arrange
    request = GitHubProfileRequest(username="   ")

    # Act / Assert
    with pytest.raises(ValueError, match="username must not be empty"):
        await fetch_user_profile(request)


@pytest.mark.asyncio
async def test_fetch_user_language_stats_returns_language_counts(mocker: pytest.MockFixture) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"language": "Python"},
        {"language": "Python"},
        {"language": "JavaScript"},
        {"language": None},
        {"language": ""},
    ]
    mock_response.raise_for_status.return_value = None
    mock_get = mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)

    # Act
    language_stats = await fetch_user_language_stats(" octocat ")

    # Assert
    assert language_stats == {"Python": 2, "JavaScript": 1}
    mock_get.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_user_language_stats_translates_404_to_domain_error(mocker: pytest.MockFixture) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 404
    mock_response.json.return_value = []
    mock_response.raise_for_status.return_value = None
    mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)

    # Act / Assert
    with pytest.raises(GitHubNotFoundError, match="GitHub user 'missing' not found"):
        await fetch_user_language_stats("missing")
