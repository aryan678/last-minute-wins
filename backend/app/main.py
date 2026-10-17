"""ClaimWise AI backend. Run with: uvicorn app.main:app --reload --port 8000 (from the backend folder)."""
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import get_settings

app = FastAPI(
    title="ClaimWise AI API",
    version="0.1.0",
    description="Catastrophe exposure and claims decision-support API. Demo data by default. Does not make claim decisions.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)
app.include_router(router)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    # Keep internal details out of responses. The traceback stays in server logs.
    return JSONResponse(status_code=500, content={"detail": "Unexpected server error. Check server logs."})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
