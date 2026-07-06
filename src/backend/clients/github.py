from __future__ import annotations

from collections import Counter
import os
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field


load_dotenv()
print("GITHUB_TOKEN loaded:", bool(os.getenv("GITHUB_TOKEN")))


class GitHubNotFoundError(Exception):
    """Raised when GitHub reports that a user does not exist."""


class GitHubRateLimitError(Exception):
    """Raised when GitHub reports that the API rate limit was exceeded."""


class GitHubProfileRequest(BaseModel):
    username: str
    base_url: str = "https://api.github.com"
    user_agent: str = "Git-AnAIlyzer"
    timeout: float = 10.0


class GitHubProfileResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    login: str | None = None
    name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None
    followers: int = 0
    public_repos: int = 0
    html_url: str | None = None
    top_topics: list["GitHubTopicFrequencyResponse"] = Field(default_factory=list)


class GitHubTopicFrequencyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    count: int


class GitHubRepositoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    html_url: str | None = None
    stargazers_count: int = 0
    forks_count: int = 0
    language: str | None = None
    pushed_at: str | None = None
    updated_at: str | None = None
    topics: list[str] = Field(default_factory=list)


class GitHubTopRepositoryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    html_url: str | None = None
    stargazers_count: int = 0
    language: str | None = None
    pushed_at: str | None = None
    topics: list[str] = Field(default_factory=list)


class GitHubRepositoryAnalyticsResponse(BaseModel):
    total_stars: int = 0
    total_forks: int = 0
    total_prs: int = 0
    languages: dict[str, int]
    repositories: list[GitHubTopRepositoryResponse] = Field(default_factory=list)
    top_repos: list[GitHubTopRepositoryResponse]


def _build_github_headers(user_agent: str = "Git-AnAIlyzer") -> dict[str, str]:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": user_agent}
    github_token = os.getenv("GITHUB_TOKEN", "").strip()
    if github_token:
        headers["Authorization"] = f"token {github_token}"
    return headers


def _raise_for_github_errors(response: httpx.Response, normalized_username: str) -> None:
    if response.status_code == 404:
        raise GitHubNotFoundError(f"GitHub user '{normalized_username}' not found")

    if response.status_code == 403:
        raise GitHubRateLimitError("GitHub API rate limit exceeded")


def _extract_top_topics(
    repositories: list[GitHubRepositoryResponse],
    *,
    limit: int = 10,
) -> list[GitHubTopicFrequencyResponse]:
    topic_counts: Counter[str] = Counter()

    for repository in repositories:
        for topic in repository.topics:
            normalized_topic = topic.strip().lower()
            if normalized_topic:
                topic_counts[normalized_topic] += 1

    sorted_topics = sorted(topic_counts.items(), key=lambda item: (-item[1], item[0]))
    return [
        GitHubTopicFrequencyResponse(name=topic, count=count)
        for topic, count in sorted_topics[:limit]
    ]


async def fetch_user_profile(request: GitHubProfileRequest) -> GitHubProfileResponse:
    normalized_username = request.username.strip()
    if not normalized_username:
        raise ValueError("username must not be empty")

    url = f"{request.base_url}/users/{quote(normalized_username)}"
    repos_url = f"{request.base_url}/users/{quote(normalized_username)}/repos"
    headers = _build_github_headers(request.user_agent)

    parsed_repositories: list[GitHubRepositoryResponse] = []

    async with httpx.AsyncClient(timeout=request.timeout, headers=headers) as client:
        response = await client.get(url)

        _raise_for_github_errors(response, normalized_username)

        response.raise_for_status()
        profile_payload = response.json()

        page = 1
        per_page = 100
        while True:
            repos_response = await client.get(
                repos_url,
                params={"per_page": per_page, "page": page},
            )

            _raise_for_github_errors(repos_response, normalized_username)

            repos_response.raise_for_status()
            repositories_payload = repos_response.json()

            if not repositories_payload:
                break

            parsed_repositories.extend(
                GitHubRepositoryResponse.model_validate(repository)
                for repository in repositories_payload
            )

            if len(repositories_payload) < per_page:
                break

            page += 1

    top_topics = _extract_top_topics(parsed_repositories)
    profile_payload["top_topics"] = [topic.model_dump() for topic in top_topics]
    return GitHubProfileResponse.model_validate(profile_payload)


async def fetch_user_language_stats(username: str) -> dict[str, int]:
    normalized_username = username.strip()
    if not normalized_username:
        raise ValueError("username must not be empty")

    headers = _build_github_headers()
    base_url = "https://api.github.com"
    per_page = 100
    page = 1
    language_counts: Counter[str] = Counter()

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        while True:
            url = f"{base_url}/users/{quote(normalized_username)}/repos"
            response = await client.get(url, params={"per_page": per_page, "page": page})

            _raise_for_github_errors(response, normalized_username)

            response.raise_for_status()
            repositories = response.json()

            if not repositories:
                break

            for repository in repositories:
                language = GitHubRepositoryResponse.model_validate(repository).language
                if language:
                    language_counts[language] += 1

            if len(repositories) < per_page:
                break

            page += 1

    return dict(language_counts)


async def fetch_user_repos_analytics(username: str) -> GitHubRepositoryAnalyticsResponse:
    normalized_username = username.strip()
    if not normalized_username:
        raise ValueError("username must not be empty")

    headers = _build_github_headers()
    repos_url = f"https://api.github.com/users/{quote(normalized_username)}/repos"
    search_url = "https://api.github.com/search/issues"
    per_page = 100
    page = 1
    repository_pages: list[dict[str, object]] = []

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        while True:
            response = await client.get(repos_url, params={"per_page": per_page, "page": page})

            _raise_for_github_errors(response, normalized_username)

            response.raise_for_status()
            repositories = response.json()

            if not repositories:
                break

            repository_pages.extend(repositories)

            if len(repositories) < per_page:
                break

            page += 1

        pr_response = await client.get(search_url, params={"q": f"type:pr author:{normalized_username}"})

    _raise_for_github_errors(pr_response, normalized_username)

    pr_response.raise_for_status()
    total_prs = int(pr_response.json().get("total_count", 0))

    parsed_repositories = [GitHubRepositoryResponse.model_validate(repository) for repository in repository_pages]
    total_stars = sum(repository.stargazers_count for repository in parsed_repositories)
    total_forks = sum(repository.forks_count for repository in parsed_repositories)

    language_counts: Counter[str] = Counter()
    for repository in parsed_repositories:
        if repository.language:
            language_counts[repository.language] += 1

    sorted_repositories = sorted(
        parsed_repositories,
        key=lambda repository: repository.stargazers_count,
        reverse=True,
    )

    return GitHubRepositoryAnalyticsResponse(
        total_stars=total_stars,
        total_forks=total_forks,
        total_prs=total_prs,
        languages=dict(language_counts),
        repositories=[
            GitHubTopRepositoryResponse(
                name=repository.name,
                description=repository.description,
                html_url=repository.html_url,
                stargazers_count=repository.stargazers_count,
                language=repository.language,
                pushed_at=repository.pushed_at or repository.updated_at,
                topics=repository.topics,
            )
            for repository in parsed_repositories
        ],
        top_repos=[
            GitHubTopRepositoryResponse(
                name=repository.name,
                description=repository.description,
                html_url=repository.html_url,
                stargazers_count=repository.stargazers_count,
                language=repository.language,
                pushed_at=repository.pushed_at or repository.updated_at,
                topics=repository.topics,
            )
            for repository in sorted_repositories
        ],
    )
