# FastAPI Python

## Key Principles
- Favor functional, declarative programming over class-based approaches.
- Follow the RORO pattern: Receive an Object, Return an Object.
- Keep routing logic separate from business logic and GitHub API client logic.
- Do not use or suggest databases or ORMs. This project is completely stateless.

## Python / FastAPI Standards
- Use type hints for all function signatures.
- Prefer Pydantic v2 models over raw dictionaries when defining request and response shapes.
- Use `def` for pure functions and `async def` for asynchronous operations such as external HTTP requests.
- Keep route handlers minimal: validate input, call a service or client function, and return the response.

## Error Handling
- Handle edge cases at function entry points using early returns.
- Use guard clauses for preconditions.
- If a GitHub API call fails with a not-found case, catch the domain exception in the router and raise `HTTPException(status_code=404)`.
- Keep rate-limit and other API failures explicit so the UI can show a clear error state.

## Practical Patterns
- Put aggregation and transformation in dedicated helper or service functions.
- Keep request handling, HTTP concerns, and data shaping separate.
- Prefer small, composable functions that are easy to test with mocked GitHub API responses.

## Example Shape
```python
from fastapi import APIRouter, HTTPException

from backend.clients.github import GitHubClient, GitHubNotFoundError
from backend.services.profile import build_profile_summary

router = APIRouter()


@router.get("/users/{username}")
async def get_user_profile(username: str) -> dict:
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    client = GitHubClient()

    try:
        profile = await client.fetch_profile(username)
        repositories = await client.fetch_repositories(username)
    except GitHubNotFoundError as exc:
        raise HTTPException(status_code=404, detail="User not found") from exc

    return build_profile_summary(profile, repositories)
```