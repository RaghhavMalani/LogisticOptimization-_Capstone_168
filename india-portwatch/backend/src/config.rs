//! Runtime configuration: where the model outputs live and where to listen.
//!
//! The backend never runs ML. It serves whatever the (Python or Rust) model
//! pipeline last wrote under `outputs/`. Paths are resolved at startup:
//!   1. `PORTWATCH_OUTPUTS_DIR` env var, if set
//!   2. `../outputs`   (workspace lives inside the capstone repo)
//!   3. `./outputs`

use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub outputs_dir: PathBuf,
    pub frontend_dir: PathBuf,
    pub bind_addr: String,
}

impl Config {
    pub fn from_env() -> Self {
        let outputs_dir = std::env::var("PORTWATCH_OUTPUTS_DIR")
            .map(PathBuf::from)
            .ok()
            .or_else(|| first_existing(&["../outputs", "./outputs", "../../outputs"]))
            .unwrap_or_else(|| PathBuf::from("../outputs"));

        let frontend_dir = std::env::var("PORTWATCH_FRONTEND_DIR")
            .map(PathBuf::from)
            .ok()
            .or_else(|| first_existing(&["./frontend-react/dist", "../frontend-react/dist", "./frontend", "../frontend"]))
            .unwrap_or_else(|| PathBuf::from("./frontend"));

        let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
        Config {
            outputs_dir,
            frontend_dir,
            bind_addr: format!("0.0.0.0:{port}"),
        }
    }
}

fn first_existing(candidates: &[&str]) -> Option<PathBuf> {
    candidates
        .iter()
        .map(PathBuf::from)
        .find(|p| p.exists())
}
