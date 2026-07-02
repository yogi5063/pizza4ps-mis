"""
Pizza 4P's MIS Dashboard – FastAPI Backend
==========================================
Run with:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# ── Load environment variables before anything else ───────────────────────────
load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pizza 4P's MIS Dashboard API",
    description=(
        "Management Information System backend for Pizza 4P's restaurant chain. "
        "Provides Revenue analytics, COGS analysis, and operational KPIs."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS – allow all origins for dev ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Import and include routers ────────────────────────────────────────────────
from routers.auth import router as auth_router
from routers.upload import router as upload_router
from routers.data import router as data_router
from routers.settings import router as settings_router
from routers.masters import router as masters_router
from routers.users import router as users_router

app.include_router(auth_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
app.include_router(data_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(masters_router, prefix="/api")
app.include_router(users_router, prefix="/api")

# ── Static files – serve React SPA from frontend/dist ────────────────────────
# Path(__file__).parent = backend/  →  .parent = repo root
_dist_dir = Path(__file__).parent.parent / "frontend" / "dist"

if _dist_dir.exists():
    _assets_dir = _dist_dir / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="static_assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        candidate = _dist_dir / full_path
        if candidate.is_file():
            return FileResponse(str(candidate))
        return FileResponse(str(_dist_dir / "index.html"))

    logger.info("Serving React SPA from %s", _dist_dir.resolve())


# ── Startup event ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("Starting Pizza 4P's MIS Dashboard backend...")

    # 1. Create database tables
    from database import create_tables
    create_tables()
    logger.info("Database tables created / verified.")

    # 2. Create default admin user
    from database import SessionLocal
    from services.auth_service import create_default_admin
    db = SessionLocal()
    try:
        create_default_admin(db)
        logger.info("Default admin user verified.")
    finally:
        db.close()

    # 2b. Seed geography masters (Country -> Location -> Outlet) once
    from routers.masters import seed_masters
    db_seed = SessionLocal()
    try:
        seed_masters(db_seed)
        logger.info("Geography masters verified/seeded.")
    finally:
        db_seed.close()

    # 3. Ensure uploads directory exists
    upload_dir = Path(os.getenv("UPLOAD_DIR", "./uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Uploads directory ready: %s", upload_dir.resolve())

    # 4. Seed default settings
    from services.auth_service import get_current_user  # noqa – ensures import
    db2 = SessionLocal()
    try:
        from routers.settings import _init_defaults
        _init_defaults(db2)
        logger.info("Default settings seeded.")
    finally:
        db2.close()

    logger.info("Startup complete. API available at http://localhost:8000/docs")


# ── Shutdown event ────────────────────────────────────────────────────────────
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Pizza 4P's MIS Dashboard backend.")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "service": "Pizza 4P's MIS Dashboard API",
        "version": "1.0.0",
    }


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "true").lower() == "true"

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )
