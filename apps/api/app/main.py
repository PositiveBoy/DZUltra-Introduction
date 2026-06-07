from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, maps, mock, profiles, providers, routes, traces

app = FastAPI(
    title="DZUltra API",
    description="FastAPI backend for 点仔 Ultra local route planning.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mock.router)
app.include_router(profiles.router)
app.include_router(routes.router)
app.include_router(chat.router)
app.include_router(maps.router)
app.include_router(providers.router)
app.include_router(traces.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
