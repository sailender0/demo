from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "Enterprise Integration Platform"
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"

    # Security
    secret_key: str
    encryption_key: str
    access_token_expire_minutes: int = 480  # 8 hours

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Kafka
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_events: str = "integration-events"
    kafka_topic_webhooks: str = "webhook-raw"
    kafka_topic_backfill: str = "backfill-jobs"
    kafka_consumer_group: str = "enterprise-workers"

    # Microsoft Entra ID
    entra_tenant_id: str
    entra_client_id: str
    entra_client_secret: str

    # GitHub App
    github_app_id: str
    github_app_private_key: str   # base64-encoded PEM
    github_webhook_secret: str

    # Jira OAuth 2.0 (3LO)
    jira_client_id: str
    jira_client_secret: str
    jira_auth_url: str = "https://auth.atlassian.com/authorize"
    jira_token_url: str = "https://auth.atlassian.com/oauth/token"
    jira_redirect_uri: str = "http://localhost:8001/api/v1/admin/integrations/jira/callback"

    # Teams / Graph API (reuses Entra credentials)
    teams_client_id: str
    teams_client_secret: str
    teams_redirect_uri: str = "http://localhost:8001/api/v1/admin/integrations/teams/callback"

    # Rate limiting budgets (requests/hour per integration per tenant)
    github_rt_budget: int = 1000
    github_sync_budget: int = 1500
    github_backfill_budget: int = 2000

    # Token refresh safety margin (seconds before expiry to refresh)
    token_refresh_margin_seconds: int = 900  # 15 minutes

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
