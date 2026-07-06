from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from backend.clients import (
    GitHubNotFoundError,
    GitHubClient,
    GitHubProfileRequest,
    GitHubProfileResponse,
    GitHubRateLimitError,
)
from backend.services import ProfileService


router = APIRouter(prefix="/api/profile", tags=["profile"])
_profile_service = ProfileService(github_client=GitHubClient())


async def fetch_user_profile(request: GitHubProfileRequest) -> GitHubProfileResponse:
    return await _profile_service.get_profile(request)


@router.get("/{username}", response_model=GitHubProfileResponse)
async def get_profile(username: str) -> GitHubProfileResponse:
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    request = GitHubProfileRequest(username=normalized_username)

    try:
        return await fetch_user_profile(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GitHubNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GitHubRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub profile") from exc