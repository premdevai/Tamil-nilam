from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Data-ops settings with a hard staging-schema boundary."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    reviewer_database_url: str | None = None
    database_schema: str = "staging"

    @field_validator("database_schema")
    @classmethod
    def require_staging_schema(cls, value: str) -> str:
        if value != "staging":
            raise ValueError("dataops may only write to the staging schema")
        return value

    def require_reviewer_database_url(self) -> str:
        if not self.reviewer_database_url:
            raise ValueError(
                "reviewer_database_url is required for human review; "
                "never reuse the scraper credential"
            )
        if self.reviewer_database_url == self.database_url:
            raise ValueError("scraper and reviewer database credentials must be different")
        return self.reviewer_database_url
