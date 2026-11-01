import asyncio

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    deps = request.app.state.deps
    store_ok = await asyncio.to_thread(deps.store.ping)
    return {
        "status": "ok" if store_ok else "degraded",
        "provider": deps.llm.name,
        "store": deps.store.kind,
        "storeReachable": store_ok,
    }
