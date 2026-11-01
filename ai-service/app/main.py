import json
import logging
import time
import uuid

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .api import health, ingest, plan, quiz, studio, tutor
from .auth import verify_service_token
from .config import Settings, get_settings
from .graphs.planner_graph import build_planner_graph
from .graphs.quiz_graph import build_quiz_graph
from .graphs.studio_graph import build_studio_graph
from .graphs.tutor_graph import build_tutor_graph
from .services.container import Deps
from .services.llm import LLM, build_llm
from .services.store import IndexCache, MemoryStore, MongoStore, Store

log = logging.getLogger("adaptlearn.ai")


def create_app(settings: Settings | None = None, store: Store | None = None, llm: LLM | None = None) -> FastAPI:
    settings = settings or get_settings()
    if store is None:
        store = MongoStore(settings.mongo_uri, settings.mongo_db) if settings.mongo_uri else MemoryStore()
    deps = Deps(settings=settings, store=store, cache=IndexCache(store), llm=llm or build_llm(settings))

    app = FastAPI(title="AdaptLearn AI Service", version="1.0.0", docs_url=None if settings.environment == "production" else "/docs")
    app.state.deps = deps
    app.state.graphs = {
        "tutor": build_tutor_graph(deps),
        "quiz": build_quiz_graph(deps),
        "planner": build_planner_graph(deps),
        "studio": build_studio_graph(),
    }

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        # Bodies are never logged: they contain student questions.
        log.info(json.dumps({"id": request_id, "method": request.method, "path": request.url.path,
                             "status": response.status_code, "ms": round((time.perf_counter() - started) * 1000, 1)}))
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, error: RequestValidationError):
        first = error.errors()[0]
        where = ".".join(str(p) for p in first["loc"] if p != "body")
        return JSONResponse(status_code=422, content={"detail": f"Invalid request: {where}: {first['msg']}"})

    @app.exception_handler(Exception)
    async def unexpected(request: Request, error: Exception):
        log.exception("unhandled error on %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "The AI service hit an internal error."})

    app.include_router(health.router)
    secured = [Depends(verify_service_token)]
    for module in (tutor, quiz, plan, studio, ingest):
        app.include_router(module.router, dependencies=secured)
    return app


def _default_app() -> FastAPI:
    return create_app()


# `uvicorn app.main:app` — created lazily so importing the module in tests has no side effects.
def __getattr__(name: str):
    if name == "app":
        instance = _default_app()
        globals()["app"] = instance
        return instance
    raise AttributeError(name)
