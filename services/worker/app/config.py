"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    # App
    app_name: str = "ai-video-worker"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # Celery / Redis
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    celery_broker_url: str = Field(default="redis://localhost:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://localhost:6379/1", alias="CELERY_RESULT_BACKEND")

    # Model gateway
    model_provider: str = Field(default="mock", alias="MODEL_PROVIDER")
    model_api_key: str = Field(default="", alias="MODEL_API_KEY")
    model_base_url: str = Field(default="", alias="MODEL_BASE_URL")
    model_name: str = Field(default="mock-video-v1", alias="MODEL_NAME")

    # Fal (optional real provider)
    fal_api_key: str = Field(default="", alias="FAL_API_KEY")
    fal_model: str = Field(default="", alias="FAL_MODEL")
    fal_base_url: str = Field(default="https://fal.run", alias="FAL_BASE_URL")

    # Replicate (optional real provider) - token may reuse MODEL_API_KEY
    replicate_api_token: str = Field(default="", alias="REPLICATE_API_TOKEN")

    # Object storage provider ("s3" for AWS/MinIO, "aliyun" for Aliyun OSS)
    storage_provider: str = Field(default="s3", alias="STORAGE_PROVIDER")

    # Local media serving (used when no object storage bucket is configured).
    # Files under `media_dir` are exposed at `{media_base_url}/files/...`.
    media_dir: str = Field(default="/tmp/ai-video", alias="MEDIA_DIR")
    media_base_url: str = Field(default="http://localhost:8000", alias="MEDIA_BASE_URL")

    # S3 / object storage
    s3_bucket: str = Field(default="", alias="S3_BUCKET")
    s3_region: str = Field(default="us-east-1", alias="S3_REGION")
    s3_endpoint_url: str = Field(default="", alias="S3_ENDPOINT_URL")
    aws_access_key_id: str = Field(default="", alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str = Field(default="", alias="AWS_SECRET_ACCESS_KEY")

    # Aliyun OSS (object storage)
    aliyun_oss_bucket: str = Field(default="", alias="ALIYUN_OSS_BUCKET")
    aliyun_oss_region: str = Field(default="cn-shanghai", alias="ALIYUN_OSS_REGION")
    aliyun_oss_endpoint: str = Field(default="", alias="ALIYUN_OSS_ENDPOINT")
    aliyun_oss_use_internal: bool = Field(default=False, alias="ALIYUN_OSS_USE_INTERNAL")
    aliyun_oss_access_key_id: str = Field(default="", alias="ALIYUN_OSS_ACCESS_KEY_ID")
    aliyun_oss_access_key_secret: str = Field(
        default="", alias="ALIYUN_OSS_ACCESS_KEY_SECRET"
    )
    aliyun_oss_sts_token: str = Field(default="", alias="ALIYUN_OSS_STS_TOKEN")
    aliyun_oss_public_base_url: str = Field(
        default="", alias="ALIYUN_OSS_PUBLIC_BASE_URL"
    )

    # CDN (Aliyun CDN in front of OSS)
    cdn_domain: str = Field(default="", alias="CDN_DOMAIN")
    cdn_auth_key: str = Field(default="", alias="CDN_AUTH_KEY")
    cdn_url_ttl_seconds: int = Field(default=3600, alias="CDN_URL_TTL_SECONDS")

    # FFmpeg
    ffmpeg_binary: str = Field(default="ffmpeg", alias="FFMPEG_BINARY")
    ffprobe_binary: str = Field(default="ffprobe", alias="FFPROBE_BINARY")
    hls_segment_duration: int = Field(default=2, alias="HLS_SEGMENT_DURATION")

    # Moderation
    moderation_enabled: bool = Field(default=True, alias="MODERATION_ENABLED")
    moderation_provider: str = Field(default="mock", alias="MODERATION_PROVIDER")
    moderation_api_key: str = Field(default="", alias="MODERATION_API_KEY")
    moderation_base_url: str = Field(default="", alias="MODERATION_BASE_URL")
    moderation_fallback_provider: str = Field(default="openai", alias="MODERATION_FALLBACK_PROVIDER")

    # Aliyun (Alibaba Cloud) content security
    aliyun_access_key_id: str = Field(default="", alias="ALIYUN_ACCESS_KEY_ID")
    aliyun_access_key_secret: str = Field(default="", alias="ALIYUN_ACCESS_KEY_SECRET")
    aliyun_region: str = Field(default="cn-shanghai", alias="ALIYUN_REGION")
    aliyun_content_security_endpoint: str = Field(default="", alias="ALIYUN_CONTENT_SECURITY_ENDPOINT")

    # Tencent Cloud content security
    tencent_secret_id: str = Field(default="", alias="TENCENT_SECRET_ID")
    tencent_secret_key: str = Field(default="", alias="TENCENT_SECRET_KEY")
    tencent_region: str = Field(default="ap-guangzhou", alias="TENCENT_REGION")
    tencent_content_security_endpoint: str = Field(default="", alias="TENCENT_CONTENT_SECURITY_ENDPOINT")

    # API callback
    api_base_url: str = Field(default="http://localhost:4000", alias="API_BASE_URL")
    api_internal_token: str = Field(default="", alias="API_INTERNAL_TOKEN")

    # Task defaults
    task_time_limit: int = Field(default=600, alias="TASK_TIME_LIMIT")
    task_soft_time_limit: int = Field(default=540, alias="TASK_SOFT_TIME_LIMIT")

    # Retry / backoff
    task_max_retries: int = Field(default=3, alias="TASK_MAX_RETRIES")
    task_retry_backoff_seconds: int = Field(default=5, alias="TASK_RETRY_BACKOFF_SECONDS")
    task_retry_backoff_max: int = Field(default=60, alias="TASK_RETRY_BACKOFF_MAX")

    # Kafka / event publishing
    kafka_bootstrap_servers: str = Field(default="", alias="KAFKA_BOOTSTRAP_SERVERS")
    kafka_topic_events: str = Field(default="ai-video.events", alias="KAFKA_TOPIC_EVENTS")
    kafka_client_id: str = Field(default="ai-video-worker", alias="KAFKA_CLIENT_ID")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
