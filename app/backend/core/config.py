import logging
import os
from typing import Any

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Application
    app_name: str = "LOBOKO API"
    debug: bool = False
    version: str = "1.0.0"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000


    @property
    def backend_url(self) -> str:
        """Generate backend URL from host and port."""
        display_host = "127.0.0.1" if self.host == "0.0.0.0" else self.host
        return os.environ.get("PYTHON_BACKEND_URL", f"http://{display_host}:{self.port}")

    class Config:
        case_sensitive = False
        extra = "ignore"

    def __getattr__(self, name: str) -> Any:
        """
        Dynamically read attributes from environment variables.
        For example: settings.opapi_key reads from OPAPI_KEY environment variable.

        Args:
            name: Attribute name (e.g., 'opapi_key')

        Returns:
            Value from environment variable

        Raises:
            AttributeError: If attribute doesn't exist and not found in environment variables
        """
        # Convert attribute name to environment variable name (snake_case -> UPPER_CASE)
        env_var_name = name.upper()

        # Check if environment variable exists
        if env_var_name in os.environ:
            value = os.environ[env_var_name]
            # Cache the value in instance dict to avoid repeated lookups
            self.__dict__[name] = value
            logger.debug(f"Read dynamic attribute {name} from environment variable {env_var_name}")
            return value

        # If not found, raise AttributeError to maintain normal Python behavior
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{name}'")


# Global settings instance
settings = Settings()
