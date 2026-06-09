from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI


API_ROOT = Path(__file__).resolve().parents[1] / "apps" / "api"
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.main import app as dzultra_api  # noqa: E402


app = FastAPI(
    title="DZUltra Vercel API Entrypoint",
    description="Vercel serverless wrapper for the DZUltra FastAPI backend.",
)

app.mount("/api", dzultra_api)
app.mount("/", dzultra_api)
