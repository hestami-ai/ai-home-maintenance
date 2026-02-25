"""
Configuration management for the Historian Agent Platform.

Loads configuration from environment variables and config files,
with sensible defaults for local development.
"""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class DoltConfig(BaseSettings):
    """Dolt (Truth Store) connection configuration."""

    model_config = SettingsConfigDict(env_prefix="DOLT_")

    host: str = "dolt"
    port: int = 3306
    user: str = "root"
    password: str = ""  # Dolt default root has no password
    database: str = "dolt"  # Dolt uses directory name as database


class VLLMConfig(BaseSettings):
    """vLLM inference server configuration."""

    model_config = SettingsConfigDict(env_prefix="VLLM_")

    url: str = "http://vllm:8000/v1"
    api_key: str = "local-api-key"
    model: str = "qwen3-4b-thinking"
    temperature: float = 0.0  # Deterministic by default
    max_tokens: int = 8192
    timeout: int = 180  # seconds


class PageIndexConfig(BaseSettings):
    """PageIndex (Document Retrieval) configuration."""

    model_config = SettingsConfigDict(env_prefix="PAGEINDEX_")

    url: str = "http://pageindex:8080"
    docs_dir: str = "/data/specs"
    index_dir: str = "/data/index"
    timeout: int = 60  # seconds


class OrchestratorConfig(BaseSettings):
    """Main orchestrator configuration."""

    model_config = SettingsConfigDict(env_prefix="HISTORIAN_")

    # Processing settings
    coverage_threshold: float = Field(
        default=0.9,
        description="Minimum coverage ratio required (0.0-1.0)"
    )
    allow_degraded_mode: bool = Field(
        default=False,
        description="If True, allow REVISE verdict on coverage gaps instead of FAIL"
    )
    retrieval_instability_threshold: float = Field(
        default=0.3,
        description="Maximum allowed entropy/variance in retrieval results"
    )

    # Logging and audit
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    audit_bundle_dir: Path = Path("/logs/audit_bundles")

    # Runtime settings
    max_retries: int = 3
    run_seed: int | None = Field(
        default=None,
        description="Fixed seed for deterministic runs (None = auto-generate)"
    )


class Settings(BaseSettings):
    """Root settings aggregating all configuration sections."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    dolt: DoltConfig = Field(default_factory=DoltConfig)
    vllm: VLLMConfig = Field(default_factory=VLLMConfig)
    pageindex: PageIndexConfig = Field(default_factory=PageIndexConfig)
    orchestrator: OrchestratorConfig = Field(default_factory=OrchestratorConfig)


# Global settings instance (lazy-loaded)
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get or create the global settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
