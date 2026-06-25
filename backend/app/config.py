from pydantic_settings import BaseSettings
from pydantic import model_validator
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

    # Microsoft Entra ID (SSO)
    entra_tenant_id: str
    entra_client_id: str
    entra_client_secret: str

    # GitHub — personal access token with read:org + repo scopes
    github_token: str = ""
    github_org: str = ""

    # GitLab — personal access token with read_api scope
    gitlab_token: str = ""
    gitlab_url: str = "https://gitlab.com"  # change for self-hosted

    # Jira — service account with read access across the org
    jira_base_url: str = ""   # e.g. https://yourcompany.atlassian.net
    jira_email: str = ""      # service account email
    jira_api_token: str = ""  # API token from id.atlassian.com/manage-profile/security/api-tokens

    # Teams / Graph API (reuses Entra credentials)
    teams_client_id: str = ""
    teams_client_secret: str = ""

    @model_validator(mode="after")
    def _fill_teams_from_entra(self) -> "Settings":
        if not self.teams_client_id:
            self.teams_client_id = self.entra_client_id
        if not self.teams_client_secret:
            self.teams_client_secret = self.entra_client_secret
        return self

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
