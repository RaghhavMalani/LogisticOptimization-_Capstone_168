pub mod forecast;
pub mod live;
pub mod news;
pub mod port;
pub mod regime;
pub mod scenario;
pub mod ship;
pub mod status;

pub use forecast::*;
pub use live::*;
pub use news::*;
pub use port::*;
pub use regime::*;
pub use scenario::*;
pub use ship::*;
pub use status::*;

use serde::Serialize;

/// Wrapper used by every endpoint so the client always knows whether it is
/// looking at real model outputs or the demo fallback.
#[derive(Debug, Clone, Serialize)]
pub struct Enveloped<T: Serialize> {
    pub data_mode: &'static str, // "real" | "mock" | "partial"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
    pub data: T,
}

impl<T: Serialize> Enveloped<T> {
    pub fn real(data: T) -> Self {
        Self { data_mode: "real", warning: None, data }
    }
    pub fn mock(data: T) -> Self {
        Self {
            data_mode: "mock",
            warning: Some("Real model outputs not found; using demo data".into()),
            data,
        }
    }
    pub fn tagged(is_real: bool, data: T) -> Self {
        if is_real { Self::real(data) } else { Self::mock(data) }
    }
}
