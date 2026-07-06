from __future__ import annotations

from collections import Counter

from backend.clients.github import GitHubClient


class LanguageService:
    def __init__(self, *, github_client: GitHubClient | None = None) -> None:
        self.github_client = github_client or GitHubClient()

    async def get_language_stats(self, username: str) -> dict[str, int]:
        repositories = await self.github_client.fetch_repositories(username)

        language_counts: Counter[str] = Counter()
        for repository in repositories:
            if repository.language:
                language_counts[repository.language] += 1

        return dict(language_counts)
