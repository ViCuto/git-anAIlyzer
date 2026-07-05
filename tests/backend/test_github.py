import pytest

from backend.clients.github import (
    GitHubNotFoundError,
    GitHubProfileRequest,
    GitHubRateLimitError,
    fetch_user_repos_analytics,
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


@pytest.fixture()
def github_repos_payload() -> list[dict[str, object]]:
    return [
        {
            "name": "repo-a",
            "description": "first repo",
            "html_url": "https://github.com/octocat/repo-a",
            "stargazers_count": 10,
            "forks_count": 2,
            "language": "Python",
        },
        {
            "name": "repo-b",
            "description": "second repo",
            "html_url": "https://github.com/octocat/repo-b",
            "stargazers_count": 3,
            "forks_count": 1,
            "language": "JavaScript",
        },
        {
            "name": "repo-c",
            "description": None,
            "html_url": "https://github.com/octocat/repo-c",
            "stargazers_count": 25,
            "forks_count": 5,
            "language": "Python",
        },
        {
            "name": "repo-d",
            "description": "fourth repo",
            "html_url": "https://github.com/octocat/repo-d",
            "stargazers_count": 0,
            "forks_count": 0,
            "language": None,
        },
        {
            "name": "repo-e",
            "description": "fifth repo",
            "html_url": "https://github.com/octocat/repo-e",
            "stargazers_count": 8,
            "forks_count": 7,
            "language": "Go",
        },
        {
            "name": "repo-f",
            "description": "sixth repo",
            "html_url": "https://github.com/octocat/repo-f",
            "stargazers_count": 12,
            "forks_count": 4,
            "language": "Python",
        },
    ]


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
async def test_fetch_user_profile_translates_403_to_rate_limit_error(mocker: pytest.MockFixture) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 403
    mock_response.json.return_value = {}
    mock_response.raise_for_status.return_value = None
    mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)
    request = GitHubProfileRequest(username="octocat")

    # Act / Assert
    with pytest.raises(GitHubRateLimitError, match="GitHub API rate limit exceeded"):
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


@pytest.mark.asyncio
async def test_fetch_user_repos_analytics_returns_aggregated_metrics(
    mocker: pytest.MockFixture,
    github_repos_payload: list[dict[str, object]],
) -> None:
    # Arrange
    repos_response = mocker.Mock()
    repos_response.status_code = 200
    repos_response.json.return_value = github_repos_payload
    repos_response.raise_for_status.return_value = None

    prs_response = mocker.Mock()
    prs_response.status_code = 200
    prs_response.json.return_value = {"total_count": 44}
    prs_response.raise_for_status.return_value = None

    mock_get = mocker.patch(
        "backend.clients.github.httpx.AsyncClient.get",
        side_effect=[repos_response, prs_response],
    )

    # Act
    analytics = await fetch_user_repos_analytics(" octocat ")

    # Assert
    assert analytics.total_stars == 58
    assert analytics.total_forks == 19
    assert analytics.total_prs == 44
    assert analytics.languages == {"Python": 3, "JavaScript": 1, "Go": 1}
    assert [repo.name for repo in analytics.top_repos] == ["repo-c", "repo-f", "repo-a", "repo-e", "repo-b", "repo-d"]
    assert analytics.top_repos[0].stargazers_count == 25
    assert analytics.top_repos[0].language == "Python"
    assert analytics.top_repos[-1].language is None
    assert analytics.top_repos[-1].stargazers_count == 0
    assert mock_get.call_count == 2


@pytest.mark.asyncio
async def test_fetch_user_repos_analytics_translates_404_to_domain_error(mocker: pytest.MockFixture) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 404
    mock_response.json.return_value = []
    mock_response.raise_for_status.return_value = None
    mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)

    # Act / Assert
    with pytest.raises(GitHubNotFoundError, match="GitHub user 'missing' not found"):
        await fetch_user_repos_analytics("missing")


@pytest.mark.asyncio
async def test_fetch_user_repos_analytics_translates_403_to_rate_limit_error(mocker: pytest.MockFixture) -> None:
    # Arrange
    mock_response = mocker.Mock()
    mock_response.status_code = 403
    mock_response.json.return_value = []
    mock_response.raise_for_status.return_value = None
    mocker.patch("backend.clients.github.httpx.AsyncClient.get", return_value=mock_response)

    # Act / Assert
    with pytest.raises(GitHubRateLimitError, match="GitHub API rate limit exceeded"):
        await fetch_user_repos_analytics("missing")


@pytest.mark.asyncio
async def test_fetch_user_repos_analytics_translates_pr_search_403_to_rate_limit_error(
    mocker: pytest.MockFixture,
    github_repos_payload: list[dict[str, object]],
) -> None:
    # Arrange
    repos_response = mocker.Mock()
    repos_response.status_code = 200
    repos_response.json.return_value = github_repos_payload
    repos_response.raise_for_status.return_value = None

    prs_response = mocker.Mock()
    prs_response.status_code = 403
    prs_response.json.return_value = {}
    prs_response.raise_for_status.return_value = None

    mocker.patch(
        "backend.clients.github.httpx.AsyncClient.get",
        side_effect=[repos_response, prs_response],
    )

    # Act / Assert
    with pytest.raises(GitHubRateLimitError, match="GitHub API rate limit exceeded"):
        await fetch_user_repos_analytics("octocat")
