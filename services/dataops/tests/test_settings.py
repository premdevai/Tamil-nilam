import pytest
from pydantic import ValidationError

from nilam_dataops.settings import Settings


def test_staging_is_the_only_writable_schema() -> None:
    with pytest.raises(ValidationError):
        Settings(database_url="postgresql://localhost/nilam", database_schema="public")


def test_staging_is_the_default_schema() -> None:
    settings = Settings(database_url="postgresql://localhost/nilam")

    assert settings.database_schema == "staging"


def test_scraper_credential_cannot_be_reused_for_review() -> None:
    url = "postgresql://localhost/nilam"
    settings = Settings(database_url=url, reviewer_database_url=url)

    with pytest.raises(ValueError, match="must be different"):
        settings.require_reviewer_database_url()
