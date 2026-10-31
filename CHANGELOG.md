# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Planned
- 接入阿里云 / 腾讯云正式支付渠道密钥与对账任务
- 去水印升级为扩散修复模型（LaMa / ProPainter）
- ASR（Whisper）转写生成字幕，替代按字数均分时间轴
- 多地域对象存储与 CDN 预热

## [0.1.0] - 2026-10-31

首个可用版本：可本地完整跑通的 AI 视频生成与工具平台。

### Added

**生成能力**
- 文生视频 / 图生视频，多模型路由（Mock、OpenAI 兼容、Replicate、Fal）
- 异步任务队列（Celery + Redis）、任务状态机、失败自动重试与自动退分
- WebSocket 实时进度推送（`task:progress`），并带 HTTP 轮询降级
- FFmpeg 后处理：转码、HLS 切片、缩略图、超分、RIFE 插帧、Whisper 字幕桩
- 对象存储抽象（本地 / S3 / MinIO）、本地 `/files` 静态媒体服务

**AI 视频工具**
- AI 视频剪辑：最多 6 段拼接、时间线裁剪、BGM 混音、字幕
- AI 视频去水印：`delogo` / 区域模糊 / 马赛克，三级自动降级，区域预设与自定义
- AI 视频口播：TTS（edge-tts → macOS `say` → 静音兜底）、时长对齐、混音、SRT 字幕

**账号与安全**
- 邮箱注册登录、JWT + Refresh Token 自动续期、会话管理
- 手机号验证码登录与绑定（阿里云 / 腾讯云短信适配器）
- 邮箱验证、密码重置、TOTP 双因素、OAuth 桩（Google / GitHub）
- 实名认证（GB 11643 校验、脱敏存储）、登录风控与审计日志
- 注册赠送试用积分（`FREE_TRIAL_CREDITS`）

**计费与商业化**
- 订阅套餐、积分包、积分流水、自动续充
- Stripe Checkout + Webhook（幂等、签名校验）
- 支付宝 / 微信支付适配器（下单、查单、退款、回调验签脚手架）
- 优惠券、邀请码、推荐关系追踪
- 人民币定价展示

**运营与合规**
- 运营后台 `/admin`：用户、任务、模型、退款、审计、指标
- 内容审核适配器（阿里云 / 腾讯云 / OpenAI Moderation），审核状态与申诉入口
- 隐私政策、用户协议、退款政策、帮助中心、举报与工单
- ICP / 公安备案页脚占位与备案清单

**开放能力**
- 公开 REST API、Swagger 文档（`/docs`）、API Key 管理
- Webhook 订阅与签名投递、模型对比页、API 文档页

**数据中台**
- Kafka（KRaft）+ Schema Registry + Redpanda Console
- ClickHouse 明细与物化视图、dbt staging → marts → metrics + 数据测试
- Metabase 看板（用量、成本、转化）

**工程与部署**
- Monorepo（pnpm workspace + Turborepo）
- Docker Compose（主栈 + 数据中台）、Helm Chart、K8s 清单
- 阿里云 OSS + CDN 接入文档、Terraform、Nginx 反代配置
- 中英文本地化（next-intl）、移动端适配、无障碍分割控件
- 本地开发脚本：`scripts/dev/postgres.js`（无需 Docker 的 PostgreSQL）

### Fixed
- Celery 任务路由到 `video` 队列但 worker 只监听 `celery`，导致任务滞留
- Worker 进度回调使用 Celery id 而非业务任务 id，且 `_update_state` 递归
- Mock 生成器返回不存在的文件、后处理失败静默通过，导致产物 URL 404
- 本地产物使用 `file://` 协议，浏览器无法播放
- CORS 用通配符 + credentials，前端请求被预检拒绝
- 前端缺少 `/uploads` 接口，上传直接 404
- 移动端头部横向溢出、登录页提示文案重复

### Security
- 上传接口 MIME 白名单与大小限制，文件名随机化
- Worker 回调接口增加内部 token 校验（生产环境未配置即拒绝）
- 敏感字段（身份证、手机号、API Key）脱敏存储，审计日志记录后台写操作

[Unreleased]: https://github.com/Mosquito1123/vidforge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Mosquito1123/vidforge/releases/tag/v0.1.0
