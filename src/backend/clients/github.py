from __future__ import annotations

from collections import Counter
from urllib.parse import quote

import httpx
from pydantic import BaseModel, ConfigDict


class GitHubNotFoundError(Exception):
    """Raised when GitHub reports that a user does not exist."""


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


class GitHubRepositoryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    language: str | None = None


async def fetch_user_profile(request: GitHubProfileRequest) -> GitHubProfileResponse:
    normalized_username = request.username.strip()
    if not normalized_username:
        raise ValueError("username must not be empty")

    url = f"{request.base_url}/users/{quote(normalized_username)}"
    headers = {"Accept": "application/vnd.github+json", "User-Agent": request.user_agent}

    async with httpx.AsyncClient(timeout=request.timeout, headers=headers) as client:
        response = await client.get(url)

    if response.status_code == 404:
        raise GitHubNotFoundError(f"GitHub user '{normalized_username}' not found")

    response.raise_for_status()
    return GitHubProfileResponse.model_validate(response.json())


async def fetch_user_language_stats(username: str) -> dict[str, int]:
    normalized_username = username.strip()
    if not normalized_username:
        raise ValueError("username must not be empty")

    headers = {"Accept": "application/vnd.github+json", "User-Agent": "Git-AnAIlyzer"}
    base_url = "https://api.github.com"
    per_page = 100
    page = 1
    language_counts: Counter[str] = Counter()

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        while True:
            url = f"{base_url}/users/{quote(normalized_username)}/repos"
            response = await client.get(url, params={"per_page": per_page, "page": page})

            if response.status_code == 404:
                raise GitHubNotFoundError(f"GitHub user '{normalized_username}' not found")

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
