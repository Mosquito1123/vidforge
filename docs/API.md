# 对外开放 API（摘要）

Base URL：`http://localhost:4000`（生产为 `https://api.<domain>`）
鉴权：`Authorization: Bearer <accessToken>` 或 API Key（`X-API-Key`）

## 认证

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/register` | 注册（赠送 `FREE_TRIAL_CREDITS` 积分） |
| POST | `/auth/login` | 邮箱登录，可能返回 MFA 或风控挑战 |
| POST | `/auth/refresh` | 刷新 access token |
| POST | `/auth/logout` / `/auth/logout-all` | 登出 / 全设备登出 |
| POST | `/auth/phone/sms/send` | 发送短信验证码 |
| POST | `/auth/phone/login` | 手机号验证码登录（未注册自动创建） |

## 任务

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/tasks` | 创建任务（`tool` 选择流水线） |
| GET | `/tasks` | 当前用户任务列表 |
| GET | `/tasks/:id` | 任务详情（含 output 与进度） |
| PATCH | `/tasks/:id/cancel` | 取消 |
| PATCH | `/tasks/:id/retry` | 重试 |

### 创建任务示例

文生视频：

```bash
curl -X POST $BASE/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"model":"mock-video-v1","input":{"prompt":"a paper boat in the rain","durationSeconds":5,"aspectRatio":"16:9"}}'
```

去水印：

```json
{
  "tool": "watermark-removal",
  "input": {
    "sourceUrl": "https://cdn.example.com/input.mp4",
    "region": { "x": 76, "y": 82, "width": 20, "height": 12 },
    "method": "auto"
  }
}
```

剪辑：

```json
{
  "tool": "video-edit",
  "input": {
    "clips": ["https://…/a.mp4", "https://…/b.mp4"],
    "trimStart": 0, "trimEnd": 6,
    "bgmUrl": "https://…/music.mp3", "bgmVolume": 0.25,
    "caption": "VidForge"
  }
}
```

口播：

```json
{
  "tool": "voiceover",
  "input": {
    "script": "欢迎使用 VidForge。",
    "videoUrl": "https://…/background.mp4",
    "voice": "zh-CN-XiaoxiaoNeural",
    "burnSubtitles": true,
    "keepOriginalAudio": true
  }
}
```

### 任务产物

```json
{
  "status": "done",
  "output": {
    "url": "https://cdn.example.com/videos/<id>/final.mp4",
    "thumbnailUrl": "https://cdn.example.com/videos/<id>/thumb.jpg",
    "hlsUrl": "https://cdn.example.com/videos/<id>/hls/index.m3u8",
    "metadata": { "tool": "voiceover", "ttsProvider": "edge-tts", "duration": 6.3 }
  }
}
```

## 上传

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/uploads` | `multipart/form-data` 上传图片/视频/音频，返回 `{ url }` |
| GET | `/uploads/:filename` | 读取上传文件（本地存储模式） |

限制：`UPLOAD_MAX_BYTES`（默认 200MB），MIME 白名单见 `apps/api/src/uploads/uploads.controller.ts`。

## 计费

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/plans` / `/payments/plans` | 订阅套餐 |
| GET | `/payments/credit-packages` | 积分包 |
| POST | `/payments/checkout` | 创建支付（stripe / alipay / wechat） |
| GET | `/credits/balance` | 积分余额 |
| GET | `/credits/transactions` | 积分流水 |

## 工具目录

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/tools` | 工具与积分价格（供前端展示） |

## 进度推送

WebSocket：`ws://<host>/ws?userId=<userId>`

事件：`{"type":"task:progress","taskId":"…","status":"running","progress":40,"stage":"post_processing"}`

轮询降级：`GET /tasks/:id`。
