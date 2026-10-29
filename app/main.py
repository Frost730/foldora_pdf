import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.jobs.manager import job_manager
from app.api.routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("foldora.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch cleanup background worker
    logger.info("Starting Foldora PDF server (version %s)...", settings.APP_VERSION)
    cleanup_task = asyncio.create_task(job_manager.start_cleanup_loop())
    yield
    # Shutdown: cancel cleanup
    logger.info("Shutting down Foldora PDF server...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Full-Stack Online PDF Toolkit: Every document. One smoother workflow.",
    lifespan=lifespan
)

# Compression Middleware: compress responses >= 500 bytes (JSON, HTML, SVG, JS, CSS)
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security and Cache Headers Middleware
@app.middleware("http")
async def add_security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)

    # Security headers (Defense-in-Depth)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    # Caching strategy: immutable long-term caching for hashed assets, fresh for HTML
    path = request.url.path
    if path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path == "/" or path.endswith(".html") or (not path.startswith("/api/") and not path == "/healthz"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

    return response


# Root Health Check for Render
@app.get("/healthz")
def render_healthz():
    return {"status": "ok", "service": "foldora-pdf"}


# Mount API routes
app.include_router(api_router, prefix="/api")


# SPA Static Hosting for Vite Frontend
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API or health endpoints
        if full_path.startswith("api/") or full_path == "healthz":
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        target_file = frontend_dist / full_path
        if target_file.exists() and target_file.is_file():
            return FileResponse(target_file)

        return FileResponse(frontend_dist / "index.html")
else:
    @app.get("/")
    def fallback_root():
        return {
            "message": "Foldora PDF API is running.",
            "health": "/healthz",
            "documentation": "/docs",
            "status": "Frontend not yet built in dist/"
        }
