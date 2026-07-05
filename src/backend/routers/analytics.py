from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from backend.clients import (
    GitHubNotFoundError,
    GitHubRateLimitError,
    GitHubRepositoryAnalyticsResponse,
    fetch_user_repos_analytics,
)


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/{username}", response_model=GitHubRepositoryAnalyticsResponse)
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