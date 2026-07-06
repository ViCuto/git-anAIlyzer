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


class GitHubClient:
    def __init__(
        self,
        *,
        base_url: str = "https://api.github.com",
        user_agent: str = "Git-AnAIlyzer",
        timeout: float = 10.0,
    ) -> None:
        self.base_url = base_url
        self.user_agent = user_agent
        self.timeout = timeout

    def build_headers(self) -> dict[str, str]:
        return _build_github_headers(self.user_agent)

    @staticmethod
    def normalize_username(username: str) -> str:
        normalized_username = username.strip()
        if not normalized_username:
            raise ValueError("username must not be empty")
        return normalized_username

    async def fetch_profile_payload(self, username: str) -> dict[str, object]:
        normalized_username = self.normalize_username(username)
        url = f"{self.base_url}/users/{quote(normalized_username)}"

        async with httpx.AsyncClient(timeout=self.timeout, headers=self.build_headers()) as client:
            response = await client.get(url)

        _raise_for_github_errors(response, normalized_username)
        response.raise_for_status()
        return response.json()

    async def fetch_repositories(self, username: str) -> list[GitHubRepositoryResponse]:
        normalized_username = self.normalize_username(username)
        repos_url = f"{self.base_url}/users/{quote(normalized_username)}/repos"
        page = 1
        per_page = 100
        parsed_repositories: list[GitHubRepositoryResponse] = []

        async with httpx.AsyncClient(timeout=self.timeout, headers=self.build_headers()) as client:
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

        return parsed_repositories

    async def fetch_pull_request_count(self, username: str) -> int:
        normalized_username = self.normalize_username(username)
        search_url = f"{self.base_url}/search/issues"

        async with httpx.AsyncClient(timeout=self.timeout, headers=self.build_headers()) as client:
            pr_response = await client.get(search_url, params={"q": f"type:pr author:{normalized_username}"})

        _raise_for_github_errors(pr_response, normalized_username)
        pr_response.raise_for_status()
        return int(pr_response.json().get("total_count", 0))


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
    from backend.services.profile import ProfileService

    github_client = GitHubClient(
        base_url=request.base_url,
        user_agent=request.user_agent,
        timeout=request.timeout,
    )
    return await ProfileService(github_client=github_client).get_profile(request)


async def fetch_user_language_stats(username: str) -> dict[str, int]:
    from backend.services.languages import LanguageService

    return await LanguageService(github_client=GitHubClient()).get_language_stats(username)


async def fetch_user_repos_analytics(username: str) -> GitHubRepositoryAnalyticsResponse:
    from backend.services.analytics import AnalyticsService

    return await AnalyticsService(github_client=GitHubClient()).get_analytics(username)
