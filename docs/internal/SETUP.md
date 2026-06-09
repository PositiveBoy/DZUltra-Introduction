# DZUltra 本地开发环境

本文档记录当前仓库的本地启动方式、依赖安装方式和已知网络注意事项。

## 1. 基础环境

已确认本机环境：

- Node.js：`v24.15.0`
- npm：`11.12.1`
- Conda 环境：`agent`
- Python：`3.12.13` in `agent`

## 2. 后端环境

后端依赖已安装到现有 Conda 环境 `agent`：

- FastAPI
- Uvicorn
- Pydantic
- pytest
- httpx
- OpenAI Agents SDK

后续如需重新安装：

```bash
conda activate agent
python -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple fastapi "uvicorn[standard]" pydantic pytest httpx openai-agents
```

Provider 配置：

- 当前 V3 真实 provider 配置写在仓库根目录 `.env`，该文件被 `.gitignore` 忽略。
- 后端启动时会自动读取根目录 `.env` 和 `apps/api/.env`。
- 当前启用：高德地图 `AMAP_WEB_SERVICE_KEY`、彩云天气 `CAIYUN_WEATHER_TOKEN`、LongCat `LONGCAT_API_KEY`。
- 排队、UGC、推荐菜、用户历史行为继续 Mock。
- 可用 `GET http://localhost:8000/providers/status` 检查配置是否已生效；这个接口只返回脱敏 Key。
- 可用 `POST http://localhost:8000/providers/llm/smoke-test` 手动验证 LongCat。
- 可用 `POST http://localhost:8000/providers/weather/smoke-test` 手动验证彩云天气。

运行测试：

```bash
conda activate agent
cd apps/api
pytest
```

启动 API：

```bash
conda activate agent
cd apps/api
uvicorn app.main:app --reload --port 8000
```

可访问：

- `http://localhost:8000/health`
- `http://localhost:8000/docs`

## 3. 前端环境

前端使用 npm workspaces。安装依赖：

```bash
npm install
```

如果国内网络访问 npm 官方 registry 不稳定，可以尝试：

```bash
npm install --registry=https://registry.npmmirror.com
```

如果 `registry.npmmirror.com` DNS 解析失败，需要先切换网络、代理或 VPN 后再安装。

启动前端：

```bash
npm run dev:web
```

默认访问：

- `http://localhost:3000`

## 4. 常用命令

```bash
# 前端
npm run dev:web
npm run build:web
npm run lint:web

# 后端
npm run dev:api
npm run test:api
```

## 5. 当前状态

- 后端依赖已安装完成。
- 后端测试已通过。
- 前端依赖由于 npm registry DNS/network 问题尚未安装成功。
- 前端代码骨架已创建，待依赖安装后运行 build/lint 验证。
