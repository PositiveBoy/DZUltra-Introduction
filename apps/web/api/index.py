from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI


# 构建时已把 apps/api 复制到 ./api_backend
# vercel.json: cp -r ../../apps/api ./api_backend
API_BACKEND = Path(__file__).resolve().parent.parent / "api_backend"
if str(API_BACKEND) not in sys.path:
    sys.path.insert(0, str(API_BACKEND))

from app.main import app as dzultra_api  # noqa: E402


app = FastAPI(
    title="DZUltra API",
    description="DZUltra FastAPI backend deployed as Vercel Serverless Function.",
)

# Vercel 把 /api/* 请求路由到此文件，FastAPI 收到的路径带 /api 前缀
# dzultra_api 的路由是 /interactions/*, /maps/* 等，需要挂载到 /api 下
app.mount("/api", dzultra_api)
