# 生产部署（国内）

## 1. 前置条件

| 项 | 要求 |
|---|---|
| 域名 | 已完成 ICP 备案，建议同时完成公安联网备案 |
| 证书 | 与域名匹配的 TLS 证书（可用阿里云 SSL 证书服务签发） |
| 云资源 | 阿里云 ACK（K8s）或 ECS，RDS PostgreSQL，Redis，OSS + CDN，SLB |
| 密钥 | 全部通过 KMS / Secret Manager 注入，不入库、不入镜像 |

备案与合规清单见 `infra/compliance/icp-filing-checklist.md`。

## 2. 部署方式

### 2.1 Docker Compose（单机 / 预发）

```bash
cp apps/api/.env.example apps/api/.env    # 填入生产值
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.data.yml up -d   # 数据中台（可选）
```

### 2.2 Kubernetes（推荐）

```bash
helm upgrade --install vidforge infra/helm/ai-video-platform \
  -f infra/helm/ai-video-platform/values.aliyun.example.yaml \
  --set image.tag=<GIT_SHA> \
  --namespace vidforge --create-namespace
```

原生清单备选：`infra/k8s/`。

### 2.3 数据库迁移

```bash
kubectl exec deploy/api -- npx prisma migrate deploy
kubectl exec deploy/api -- node dist/prisma/seed.js   # 首次初始化
```

迁移务必在发布前独立执行（expand → deploy → contract），避免滚动更新期间锁表。

## 3. 反向代理与 TLS

`infra/nginx/` 提供：
- `nginx.conf`：gzip / 安全响应头 / 限流 / WebSocket 升级
- `conf.d/`：站点配置（域名、SSL、上游 api / web）
- `README.md`：证书申请与替换步骤

关键点：
- `/ws` 必须设置 `proxy_set_header Upgrade $http_upgrade;` 与 `Connection "upgrade"`
- 上传接口放宽 `client_max_body_size`（默认建议 512m）
- 生成接口单独限流，避免打满 Worker

## 4. 对象存储与 CDN（阿里云）

见 `infra/aliyun/README.md` 与 `infra/terraform/aliyun/`：

1. 创建私有 Bucket（开启服务端加密、版本控制、CORS）
2. RAM 最小权限角色（`infra/aliyun/oss-cdn-policy.json`）
3. 绑定 CDN 加速域名，回源到 OSS，开启 URL 鉴权（type A + m3u8 鉴权）
4. 缓存策略：`.m3u8` 10s，`.ts` 30d，图片 7d
5. 应用侧配置：`STORAGE_PROVIDER=aliyun`、`ALIYUN_OSS_*`、`CDN_DOMAIN`、`CDN_AUTH_KEY`

## 5. 环境变量（生产）

```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@rds-host:5432/vidforge?schema=public&sslmode=require
REDIS_URL=redis://:pass@redis-host:6379/0
JWT_SECRET=<64 字节随机值>
API_INTERNAL_TOKEN=<随机值>
WEBHOOK_SECRET=<随机值>

STRIPE_SECRET_KEY=...            # 海外
ALIPAY_APP_ID=...                # 国内
ALIPAY_PRIVATE_KEY=...
ALIPAY_PUBLIC_KEY=...
WECHAT_MCH_ID=...
WECHAT_API_V3_KEY=...

ALIYUN_SMS_ACCESS_KEY_ID=...
ALIYUN_KYC_ACCESS_KEY_ID=...
ALIYUN_CONTENT_SECURITY_KEY=...
```

完整清单见 `apps/api/.env.example`、`apps/web/.env.example`、`services/worker/.env.example`。

## 6. 发布流程

1. CI：`pnpm lint && pnpm build && pnpm test`，Worker `pytest`，dbt `dbt test`
2. 构建镜像并推送 ACR，打 `GIT_SHA` tag
3. 执行数据库迁移（向后兼容）
4. Helm 滚动更新（`maxSurge=1`，`maxUnavailable=0`）
5. 冒烟：`/health`、注册登录、创建一次 mock 生成、WebSocket 进度、支付回调
6. 观察 15 分钟错误率与延迟，异常则 `helm rollback`

## 7. 灰度与回滚

- 模型灰度：`models` 表 `active` 开关 + 按用户分组
- 支付灰度：按 provider 分流（Stripe / Alipay / WeChat 独立开关）
- 回滚：`helm rollback vidforge <rev>`；数据库回滚依赖迁移的向后兼容设计
