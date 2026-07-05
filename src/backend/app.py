from __future__ import annotations

from fastapi import FastAPI

from backend.routers.profile import router as profile_router


app = FastAPI()
app.include_router(profile_router)