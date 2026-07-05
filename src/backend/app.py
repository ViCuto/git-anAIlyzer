from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers.analytics import router as analytics_router
from backend.routers.languages import router as languages_router
from backend.routers.profile import router as profile_router


app = FastAPI()
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)
app.include_router(languages_router)
app.include_router(analytics_router)
app.include_router(profile_router)
app.mount("/", StaticFiles(directory="src/frontend", html=True), name="frontend")