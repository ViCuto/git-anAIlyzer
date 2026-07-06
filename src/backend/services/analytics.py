from __future__ import annotations

from collections import Counter

from backend.clients.github import (
    GitHubClient,
    GitHubRepositoryAnalyticsResponse,
    GitHubRepositoryResponse,
    GitHubTopRepositoryResponse,
)


class AnalyticsService:
    def __init__(self, *, github_client: GitHubClient | None = None) -> None:
        self.github_client = github_client or GitHubClient()

    async def get_analytics(self, username: str) -> GitHubRepositoryAnalyticsResponse:
        repositories = await self.github_client.fetch_repositories(username)
        total_prs = await self.github_client.fetch_pull_request_count(username)
        return self._build_analytics_response(repositories, total_prs)

    @staticmethod
    def _build_analytics_response(
        repositories: list[GitHubRepositoryResponse],
        total_prs: int,
    ) -> GitHubRepositoryAnalyticsResponse:
        total_stars = sum(repository.stargazers_count for repository in repositories)
        total_forks = sum(repository.forks_count for repository in repositories)

        language_counts: Counter[str] = Counter()
        for repository in repositories:
            if repository.language:
                language_counts[repository.language] += 1

        sorted_repositories = sorted(
            repositories,
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
                for repository in repositories
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
