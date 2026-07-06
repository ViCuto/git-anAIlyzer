import pytest

from backend.clients.github import (
    GitHubNotFoundError,
    GitHubProfileRequest,
    GitHubRateLimitError,
    _build_github_headers,
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
            "pushed_at": "2026-06-29T10:00:00Z",
            "topics": ["cli", "automation", "python"],
        },
        {
            "name": "repo-b",
            "description": "second repo",
            "html_url": "https://github.com/octocat/repo-b",
            "stargazers_count": 3,
            "forks_count": 1,
            "language": "JavaScript",
            "pushed_at": "2026-06-20T10:00:00Z",
            "topics": [],
        },
        {
            "name": "repo-c",
            "description": None,
            "html_url": "https://github.com/octocat/repo-c",
            "stargazers_count": 25,
            "forks_count": 5,
            "language": "Python",
            "pushed_at": "2026-07-01T12:00:00Z",
            "topics": ["fastapi", "analytics", "dashboard", "github"],
        },
        {
            "name": "repo-d",
            "description": "fourth repo",
            "html_url": "https://github.com/octocat/repo-d",
            "stargazers_count": 0,
            "forks_count": 0,
            "language": None,
            "updated_at": "2026-05-10T09:00:00Z",
            "topics": ["legacy"],
        },
        {
            "name": "repo-e",
            "description": "fifth repo",
            "html_url": "https://github.com/octocat/repo-e",
            "stargazers_count": 8,
            "forks_count": 7,
            "language": "Go",
            "pushed_at": "2026-06-25T14:15:00Z",
            "topics": ["go", "microservice"],
        },
        {
            "name": "repo-f",
            "description": "sixth repo",
            "html_url": "https://github.com/octocat/repo-f",
            "stargazers_count": 12,
            "forks_count": 4,
            "language": "Python",
            "pushed_at": "2026-06-30T08:30:00Z",
            "topics": ["web", "api", "devtools", "monitoring", "reports", "charts", "extra"],
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
    repos_response = mocker.Mock()
    repos_response.status_code = 200
    repos_response.json.return_value = [
        {"topics": ["python", "api", "python"]},
        {"topics": ["docker", "api"]},
    ]
    repos_response.raise_for_status.return_value = None

    empty_repos_page_response = mocker.Mock()
    empty_repos_page_response.status_code = 200
    empty_repos_page_response.json.return_value = []
    empty_repos_page_response.raise_for_status.return_value = None

    mock_get = mocker.patch(
        "backend.clients.github.httpx.AsyncClient.get",
        side_effect=[mock_response, repos_response, empty_repos_page_response],
    )
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
    assert [topic.model_dump() for topic in profile.top_topics] == [
        {"name": "api", "count": 2},
        {"name": "python", "count": 2},
        {"name": "docker", "count": 1},
    ]
    assert mock_get.call_count == 2


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
async def test_fetch_user_profile_limits_top_topics_to_top_10(
    mocker: pytest.MockFixture,
    github_profile_payload: dict[str, object],
) -> None:
    # Arrange
    profile_response = mocker.Mock()
    profile_response.status_code = 200
    profile_response.json.return_value = github_profile_payload
    profile_response.raise_for_status.return_value = None

    topics_payload = [
        {
            "topics": [
                "kafka",
                "redis",
                "python",
                "docker",
                "api",
                "fastapi",
                "charts",
                "monitoring",
                "testing",
                "ci",
                "azure",
                "analytics",
                "devops",
            ]
        }
    ]

    repos_response = mocker.Mock()
    repos_response.status_code = 200
    repos_response.json.return_value = topics_payload
    repos_response.raise_for_status.return_value = None

    empty_repos_page_response = mocker.Mock()
    empty_repos_page_response.status_code = 200
    empty_repos_page_response.json.return_value = []
    empty_repos_page_response.raise_for_status.return_value = None

    mocker.patch(
        "backend.clients.github.httpx.AsyncClient.get",
        side_effect=[profile_response, repos_response, empty_repos_page_response],
    )

    # Act
    profile = await fetch_user_profile(GitHubProfileRequest(username="octocat"))

    # Assert
    assert len(profile.top_topics) == 10
    assert [topic.name for topic in profile.top_topics] == [
        "analytics",
        "api",
        "azure",
        "charts",
        "ci",
        "devops",
        "docker",
        "fastapi",
        "kafka",
        "monitoring",
    ]


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
    assert analytics.top_repos[0].pushed_at == "2026-07-01T12:00:00Z"
    assert analytics.top_repos[0].topics == ["fastapi", "analytics", "dashboard", "github"]
    assert analytics.top_repos[-1].language is None
    assert analytics.top_repos[-1].stargazers_count == 0
    assert analytics.top_repos[-1].pushed_at == "2026-05-10T09:00:00Z"
    assert analytics.top_repos[-1].topics == ["legacy"]
    assert mock_get.call_count == 2


def test_build_github_headers_with_token_adds_authorization(monkeypatch: pytest.MonkeyPatch) -> None:
    # Arrange
    monkeypatch.setenv("GITHUB_TOKEN", "secret-token")

    # Act
    headers = _build_github_headers()

    # Assert
    assert headers == {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Git-AnAIlyzer",
        "Authorization": "token secret-token",
    }


def test_build_github_headers_without_token_omits_authorization(monkeypatch: pytest.MonkeyPatch) -> None:
    # Arrange
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)

    # Act
    headers = _build_github_headers("Custom-Agent")

    # Assert
    assert headers == {
        "Accept": "application/vnd.github+json",
        "User-Agent": "Custom-Agent",
    }


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
