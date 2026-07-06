from __future__ import annotations

from collections import Counter

from backend.clients.github import (
    GitHubClient,
    GitHubProfileRequest,
    GitHubProfileResponse,
    GitHubRepositoryResponse,
    GitHubTopicFrequencyResponse,
)


class ProfileService:
    def __init__(self, *, github_client: GitHubClient | None = None) -> None:
        self.github_client = github_client or GitHubClient()

    async def get_profile(self, request: GitHubProfileRequest) -> GitHubProfileResponse:
        profile_payload = await self.github_client.fetch_profile_payload(request.username)
        repositories = await self.github_client.fetch_repositories(request.username)
        top_topics = self._extract_top_topics(repositories)
        profile_payload["top_topics"] = [topic.model_dump() for topic in top_topics]
        return GitHubProfileResponse.model_validate(profile_payload)

    @staticmethod
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
