from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from backend.clients import (
    GitHubClient,
    GitHubNotFoundError,
    GitHubRateLimitError,
    GitHubRepositoryAnalyticsResponse,
)
from backend.services import AnalyticsService


router = APIRouter(prefix="/api/analytics", tags=["analytics"])
_analytics_service = AnalyticsService(github_client=GitHubClient())


async def fetch_user_repos_analytics(username: str) -> GitHubRepositoryAnalyticsResponse:
    return await _analytics_service.get_analytics(username)


@router.get(
    "/{username}",
    response_model=GitHubRepositoryAnalyticsResponse,
    response_model_exclude_unset=True,
)
async def get_analytics(username: str) -> GitHubRepositoryAnalyticsResponse:
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    try:
        return await fetch_user_repos_analytics(normalized_username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GitHubNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GitHubRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub analytics") from exc