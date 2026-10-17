"""FastAPI main entrypoint for Chat-Brain backend."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import hmac
import logging
from typing import Any
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.routes import router
from app.config import get_settings
from app.db.migrations import run_migrations
from app.errors import ChatBrainException
from app.logging_config import setup_logging
from app.security import TOKEN_HEADER_NAME, get_startup_token, verify_host_header

setup_logging()
logger = logging.getLogger("chatbrain.app")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Execute startup migrations and resource initializations."""
    logger.info("Initializing Chat-Brain backend...")
    applied = run_migrations()
    logger.info("Database migrations complete. Applied: %s", applied)
    yield
    logger.info("Shutting down Chat-Brain backend.")


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_middleware(request: Request, call_next: Any) -> Any:
    """Validate Host header and protect state-changing requests."""
    # Preflight options pass through
    if request.method == "OPTIONS":
        return await call_next(request)

    # 1. Validate Host header
    host_header = request.headers.get("host")
    try:
        verify_host_header(host_header)
    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={"error": {"category": "validation", "message": str(exc)}},
        )

    # 2. Enforce token for state-changing HTTP methods
    if request.method in ("PUT", "POST", "DELETE", "PATCH"):
        token = request.headers.get(TOKEN_HEADER_NAME)
        expected = get_startup_token()
        if not token or not hmac.compare_digest(token, expected):
            return JSONResponse(
                status_code=401,
                content={
                    "error": {
                        "category": "auth",
                        "message": "Unauthorized: invalid or missing X-ChatBrain-Token",
                    }
                },
            )

    return await call_next(request)


# Centralized error handlers
@app.exception_handler(ChatBrainException)
async def chatbrain_exception_handler(_: Request, exc: ChatBrainException) -> JSONResponse:
    """Handle custom application exceptions."""
    return JSONResponse(status_code=exc.status_code, content=exc.to_dict())


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    return JSONResponse(
        status_code=422,
        content={"error": {"category": "validation", "message": str(exc)}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle standard HTTP exceptions with categorized error envelope."""
    category = "internal"
    if exc.status_code in (400, 422):
        category = "validation"
    elif exc.status_code in (401, 403):
        category = "auth"
    elif exc.status_code == 404:
        category = "not_found"

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"category": category, "message": str(exc.detail)}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    """Fallback handler for unhandled exceptions."""
    logger.exception("Unhandled server exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"error": {"category": "internal", "message": "Internal server error"}},
    )


app.include_router(router)
