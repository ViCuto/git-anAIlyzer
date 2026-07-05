from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.clients import GitHubNotFoundError, fetch_user_language_stats


router = APIRouter(prefix="/api/languages", tags=["languages"])


@router.get("/{username}")
async def get_languages(username: str) -> dict[str, int]:
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(status_code=400, detail="username must not be empty")

    try:
        return await fetch_user_language_stats(normalized_username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except GitHubNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc