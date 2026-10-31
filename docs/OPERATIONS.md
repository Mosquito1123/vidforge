# 运维手册

## 1. 健康检查

| 检查项 | 地址 | 期望 |
|---|---|---|
| API 存活 | `GET /health` | `200 {"status":"ok"}` |
| API 文档 | `GET /docs` | Swagger UI |
| Worker 存活 | `GET http://worker:8000/health` | `200 {"status":"ok"}` |
| 模型网关 | `GET http://worker:8000/health/model` | 各 provider 状态 + 熔断状态 |
| Web | `GET /` | 200 |

K8s 探针已在 Helm Chart 中配置：`livenessProbe` 命中 `/health`，`readinessProbe` 命中 `/health` 且依赖 DB/Redis 可达。

## 2. 监控与告警

### 指标来源
- API：请求量、P95 延迟、5xx 率、限流命中、WebSocket 连接数
- Worker：队列长度、任务成功率、单任务时长、模型调用失败率、熔断打开次数
- 业务：注册数、首次生成转化率、付费转化、ARPU、积分消耗/成本比
- 数据中台：Kafka 消费延迟、ClickHouse 写入量、dbt 模型新鲜度

### 建议告警阈值
| 告警 | 条件 |
|---|---|
| API 5xx | 5 分钟 > 1% |
| API 延迟 | P95 > 800ms 持续 10 分钟 |
| 队列积压 | 待处理任务 > 200 持续 5 分钟 |
| 任务失败率 | 15 分钟 > 10% |
| 模型熔断 | 任一 provider 熔断打开 |
| 支付回调失败 | 任意 1 次签名校验失败（安全事件） |
| 数据库连接 | 使用率 > 80% |
| 磁盘 / 对象存储 | 使用率 > 85% |

接入方式：Prometheus + Grafana（`/metrics` 或 OpenTelemetry Collector），错误追踪接 Sentry。

## 3. 日志

- API：结构化 JSON（pino / nestjs Logger），含 `traceId`、`userId`、`taskId`
- Worker：结构化日志 + Celery task id 串联
- 审计日志：`AuditLog` 表（后台所有写操作、退款、调分、封禁）
- 保留：应用日志 30 天，审计日志 ≥ 180 天（合规要求）

禁止在日志中输出：密码、验证码、身份证号、银行卡号、API Key、完整手机号（用脱敏）。

## 4. 备份与容灾

| 数据 | 策略 | RPO | RTO |
|---|---|---|---|
| PostgreSQL | 每日全量 + WAL 归档（PITR） | ≤ 5 分钟 | ≤ 30 分钟 |
| Redis | AOF everysec + 每日 RDB 快照 | ≤ 1 秒 | ≤ 10 分钟 |
| 对象存储 | OSS 版本控制 + 跨区域复制 | ≈ 0 | ≈ 0 |
| ClickHouse | 每日备份到 OSS | 24 小时 | 2 小时 |

恢复演练：每季度一次，从备份恢复到独立环境并跑冒烟用例。

## 5. 常见故障处理

### 任务卡在 running
1. 查 Worker 日志与 Celery 队列长度
2. 检查模型厂商状态与熔断状态（`/health/model`）
3. 超时任务由看门狗标记失败并自动退分；必要时后台手动 `POST /admin/tasks/:id/cancel`

### 支付回调未生效
1. 检查 provider 后台回调记录与签名配置
2. 检查 `WebhookEvent` 是否已存在（幂等会跳过重复）
3. 核对 `ALIPAY_PUBLIC_KEY` / `WECHAT_API_V3_KEY` 是否与商户后台一致
4. 手动补偿：后台发放积分并写审计

### 内容审核误判
1. 用户申诉 → `POST /moderation/appeal`
2. 后台查看审核详情与命中标签
3. 人工复核通过后恢复任务；同类误判调整审核策略阈值

### 积分对不上
1. 对账：`CreditTransaction` 流水 vs `CreditAccount.balance`
2. 支付侧：`Payment` / `Invoice` 与 provider 账单核对
3. 修正必须走后台调分接口（自动落审计），禁止直接改库

## 6. 容量与成本

- 单卡并发：按模型显存占用设置 Worker `--concurrency`
- 成本核算：每任务记录模型调用成本与积分消耗，在 Metabase 观察「成本/积分比」
- CDN 成本：HLS 分片长缓存（30 天），封面图走图片处理参数按需生成
- 缩容：夜间低峰降低 Worker 副本，队列积压自动扩容（KEDA 基于 Redis 队列长度）

## 7. 安全运维

- 密钥每 90 天轮换（JWT、内部 token、支付密钥、OSS AK）
- 后台账号强制 MFA，操作全审计
- 定期依赖扫描（`pnpm audit`、`pip-audit`、镜像 Trivy）
- 登录风控阈值按月复核，防止误伤正常用户
