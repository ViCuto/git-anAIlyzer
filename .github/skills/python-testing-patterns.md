# Python Testing Patterns

Comprehensive guide to implementing robust testing strategies in Python using `pytest` and mocking for Git-AnAIlyzer.

## Core Concepts
- **Framework:** ALWAYS use `pytest`. Never use the standard `unittest` module.
- **AAA Pattern:** Structure tests using Arrange (set up mock data), Act (execute code), and Assert (verify results).
- **Test Isolation:** Tests should be independent with no shared state.

## Strict Mocking Rules (CRITICAL)
- **No Real Network Calls:** NEVER allow tests to make real HTTP network calls to `api.github.com`.
- Always use mocking libraries (`pytest-mock`, `unittest.mock.patch`, or `responses`) to intercept external requests.
- Provide clear, deterministic JSON mock payloads (e.g., `{"login": "octocat", "followers": 12}`).

## Test Naming Convention
- Use descriptive names following the pattern: `test_<unit>_<scenario>_<expected_outcome>`.
- Example: `test_fetch_user_profile_with_invalid_username_raises_404()`

## Coverage and Structure
- Ensure tests cover both the "happy path" (successful API response) and error paths (HTTP 404, HTTP 429 Rate Limit).
- Place all backend tests in the `tests/backend/` directory.

## Example Mocked Test
```python
import pytest
from unittest.mock import patch
from backend.clients.github import GitHubClient, GitHubNotFoundError

@pytest.mark.asyncio
async def test_fetch_profile_returns_parsed_data():
    # Arrange
    mock_payload = {"login": "octocat", "followers": 10, "public_repos": 5}
    
    # Mocking an HTTP client (like httpx)
    with patch("backend.clients.github.httpx.AsyncClient.get") as mock_get:
        mock_get.return_value.status_code = 200
        mock_get.return_value.json.return_value = mock_payload
        
        client = GitHubClient()
        
        # Act
        result = await client.fetch_profile("octocat")
        
    # Assert
    assert result["login"] == "octocat"
    assert result["followers"] == 10
    mock_get.assert_called_once()
```