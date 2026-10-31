# 系统架构

## 1. 总览

```
                    ┌───────────────────────────────┐
   浏览器 / App ───► │  Next.js Web (apps/web, 3000) │
                    │  页面 · i18n · AuthGuard      │
                    └───────┬───────────────┬───────┘
                            │ REST          │ WebSocket
                            ▼               ▼
                    ┌───────────────────────────────┐
                    │  NestJS API (apps/api, 4000)  │
                    │  Auth · Users · Credits       │
                    │  Tasks · Models · Payments    │
                    │  Admin · Moderation · KYC     │
                    └──┬────────┬─────────┬─────────┘
                       │        │         │
              Prisma   │        │ HTTP    │ 事件
                       ▼        ▼         ▼
                 PostgreSQL   Worker    Kafka ──► ClickHouse ──► dbt ──► Metabase
                 (主库)       (8000)     (数据中台)
                               │
                               ├─ 模型网关（Mock / OpenAI 兼容 / Replicate / Fal）
                               ├─ FFmpeg（超分 / 插帧 / 字幕 / 混音 / HLS）
                               ├─ 内容审核（阿里云 / 腾讯云 / OpenAI）
                               └─ 对象存储（S3 / MinIO / 阿里云 OSS）──► CDN
```

## 2. 分层职责

### apps/web（Next.js 15 App Router）
- 页面：`/`、`/generate`、`/dashboard`、`/pricing`、`/billing`、`/checkout`、`/account`、`/account/kyc`、`/admin/*`、法务与营销页
- `lib/api.ts`：统一 fetch 封装，JWT 存储、401 自动刷新、各业务 API 方法
- `lib/ws.ts` + `components/task-progress.tsx`：WebSocket 进度订阅
- `next-intl`：中英文（`messages/en.json`、`messages/zh.json`），语言切换器写入 `NEXT_LOCALE` cookie
- `components/auth-guard.tsx` / `admin-guard.tsx`：前端路由守卫（后端仍做二次鉴权）

### apps/api（NestJS）
| 模块 | 职责 |
|---|---|
| `auth` | 注册/登录/刷新/登出、邮箱验证、密码重置、MFA、OAuth 桩、会话管理 |
| `phone` + `sms` | 手机号验证码登录 / 绑定，短信适配器（阿里云 / 腾讯云） |
| `kyc` | 实名认证提交与状态查询，GB 11643 校验，脱敏存储 |
| `risk` | 登录风控评分、限流、设备/IP 扇出、挑战、审计 |
| `users` | 用户资料 |
| `credits` | 积分账户、流水、消耗、自动续充、失败退分 |
| `payments` | 套餐、Stripe Checkout/Webhook、支付宝/微信适配器、退款、发票 |
| `tasks` | 任务状态机、扣分、调用 Worker、WebSocket 进度广播 |
| `models` | 模型目录、水印策略、上架状态 |
| `moderation` | 审核查询、申诉、审计 |
| `coupons` / `invites` / `referrals` | 优惠券、邀请码、推荐关系 |
| `admin` | 运营后台 API，全部写操作落审计日志 |
| `storage` | 签名上传 / CDN 签名 URL |
| `webhooks` | 对外事件投递（签名 + 重试） |

### services/worker（FastAPI + Celery）
- `app/tasks.py`：Celery 任务编排（生成 → 审核 → 后处理 → 上传 → 回调），以及 `run_media_tool`
- `app/gateways/`：多厂商模型网关 + 熔断器 + 健康检查
- `app/postprocess/ffmpeg.py`：转码、HLS、缩略图、超分、RIFE 插帧、Whisper 字幕、音频混音
- `app/tools/`：非生成类工具流水线（剪辑 / 去水印 / 口播），共用 `finalize_video` 完成转码、缩略图、HLS 与上传
- `app/moderation/`：内容安全适配器
- `app/events/publisher.py`：Kafka 事件（任务生命周期、指标：时长 / 成本）
- `app/main.py` 挂载 `/files` 静态目录：未配置对象存储时，生成结果通过 `MEDIA_BASE_URL` 直接可播放

## 3. 任务生命周期

```
用户提交 → 校验参数 → 预估积分 → 冻结/扣除积分
      → 创建 Task(queued, tool=generate|video-edit|watermark-removal|voiceover)
      → 推送 Worker
      → running（模型推理 / FFmpeg 工具流水线，进度回调）
      → post_processing（FFmpeg / HLS / 缩略图）
      → 内容审核（命中 → blocked + 申诉入口）
      → done（产物写对象存储 → CDN URL）→ WebSocket 通知
      └ 任一步失败 → failed → 自动退分 → 记录审计
```

状态：`queued | running | post_processing | done | failed | cancelled | blocked`

## 4. 数据模型（核心表）

`User`、`CreditAccount`、`CreditTransaction`、`Task`、`TaskOutput`、`Model`、
`Plan`、`Subscription`、`Payment`、`Invoice`、`Refund`、`ApiKey`、`WebhookEndpoint`、
`Coupon`、`CouponRedemption`、`InviteCode`、`Referral`、`AuditLog`、`WebhookEvent`。

详见 `apps/api/prisma/schema.prisma`。

## 5. 数据中台

- **Kafka**：`task.events`、`task.metrics`、`payment.events` 主题
- **ClickHouse**：明细表 + 物化视图（按天 / 模型 / 用户聚合）
- **dbt**：`staging` → `marts` → `metrics`，含 `unique` / `not_null` 数据测试
- **Metabase**：用量、成本、转化漏斗看板

## 6. 关键设计取舍

| 决策 | 原因 |
|---|---|
| 异步队列而非同步推理 | 视频生成耗时数十秒到数分钟，需可取消、可重试、可限流 |
| 模型网关抽象 | 多厂商切换、灰度、熔断、成本核算 |
| WebSocket 而非轮询 | 进度实时性 + 降低 API 压力；轮询仍作为降级 |
| 积分制 | 多模型成本差异大，积分可统一计价并做促销 |
| 内容审核前置 + 异步复核 | 合规硬要求，且不阻塞主链路 |
| ComfyUI / Dify 仅作实验层 | 生产可靠性、可观测性、成本控制不足 |
