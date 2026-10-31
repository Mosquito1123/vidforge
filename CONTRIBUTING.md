# 贡献指南

感谢你愿意为 VidForge 做贡献！本文说明本地开发、提交规范与 PR 流程。

## 1. 环境准备

| 组件 | 版本 |
|---|---|
| Node.js | ≥ 20 |
| pnpm | 9（`corepack enable` 后自动启用） |
| Python | ≥ 3.11 |
| PostgreSQL | 16 |
| Redis | 7+ |
| FFmpeg | 6+（字幕烧录需 `libass` / `libfreetype`） |

```bash
git clone https://github.com/Mosquito1123/vidforge.git
cd vidforge
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

没有 Docker 或系统 PostgreSQL 时，可用内置脚本启动本地实例：

```bash
pnpm add -Dw embedded-postgres
node scripts/dev/postgres.js
```

## 2. 启动开发环境

```bash
# 终端 1 — 后端
pnpm --filter @app/api prisma generate   # 首次
pnpm --filter @app/api exec prisma migrate deploy
pnpm db:seed
pnpm --filter @app/api dev               # http://localhost:4000

# 终端 2 — 前端
pnpm --filter @app/web dev               # http://localhost:3000

# 终端 3 — Worker
cd services/worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
celery -A app.celery_app worker -l info --pool=solo   # macOS 建议 solo
```

种子账号：`test@example.com / password123`，管理员 `admin@vidforge.local / admin12345`。

## 3. 提交前自检

```bash
pnpm --filter @app/api exec tsc --noEmit
pnpm --filter @app/web exec tsc --noEmit
pnpm --filter @app/api test
cd services/worker && python3 -m pytest -q
```

CI 会对以上四项 + 前端生产构建做校验，请确保本地通过。

## 4. 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
<type>(<scope>): <subject>
```

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `refactor` | 不改变行为的重构 |
| `perf` | 性能优化 |
| `docs` | 文档 |
| `test` | 测试 |
| `chore` | 构建 / 依赖 / 工具链 |
| `ci` | CI 配置 |

示例：

```
feat(tools): add watermark region presets
fix(worker): consume the routed video queue
```

## 5. 代码约定

- **TypeScript**：不使用 `any` 逃逸类型；共享类型放 `packages/shared-types`
- **Python**：类型标注 + `from __future__ import annotations`
- **i18n**：新增文案必须同时补 `apps/web/messages/en.json` 与 `zh.json`
- **无障碍**：交互控件需可键盘操作、有可见焦点、命中区域 ≥ 44px
- **安全**：不提交任何密钥；`.env` 已在 `.gitignore` 中

## 6. PR 流程

1. 从 `main` 切分支：`feat/xxx`、`fix/xxx`
2. 保持单个 PR 聚焦一件事；附带截图 / 录屏（涉及 UI 时）
3. PR 描述中写清：动机、改动点、验证方式、风险与回滚
4. 至少一名维护者 review 通过后合并（squash merge）

## 7. 报告问题

请使用 Issue 模板，附上：

- 复现步骤与预期 / 实际结果
- 环境（OS、Node / Python 版本、是否使用 Docker）
- 相关日志（**请先脱敏**，勿粘贴 token、手机号、身份证、API Key）

安全漏洞请勿公开提交 Issue，参见 [SECURITY.md](SECURITY.md)。

## 8. 行为准则

参与本项目即表示同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
