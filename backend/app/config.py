from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
  repo_root: Path = Path(__file__).resolve().parents[2]
  enable_external_refresh: bool = False

  @property
  def data_dir(self) -> Path:
    return self.repo_root / "data"

  @property
  def outputs_dir(self) -> Path:
    return self.repo_root / "outputs"


settings = Settings()
