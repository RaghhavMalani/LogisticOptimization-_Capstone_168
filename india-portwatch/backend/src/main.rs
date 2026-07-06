//! India PortWatch — operational command center backend.
//!
//! Serves:
//!   * /api/*   typed JSON from the model-pipeline outputs (CSV), with an
//!              honest mock fallback when files are missing.
//!   * /        the static command-center frontend (SPA fallback to index.html
//!              so /ports/chennai etc. deep-link correctly).

mod config;
mod models;
mod routes;
mod services;

use std::sync::Arc;

use tower_http::cors::CorsLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    let cfg = config::Config::from_env();
    info!("outputs dir : {}", cfg.outputs_dir.display());
    info!("frontend dir: {}", cfg.frontend_dir.display());

    let store = Arc::new(services::data_loader::load(&cfg.outputs_dir));

    let index = cfg.frontend_dir.join("index.html");
    let static_site =
        ServeDir::new(&cfg.frontend_dir).not_found_service(ServeFile::new(index));

    let app = routes::api_router(store)
        .fallback_service(static_site)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    info!("India PortWatch command center on http://{}", cfg.bind_addr);
    axum::serve(listener, app).await?;
    Ok(())
}
