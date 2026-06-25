"""Forecasting layer.

The Temporal Fusion Transformer (TFT) is the intended core model. This package
provides:
  * tft_dataset.py   -- a TFT-ready dataset builder (also emits the supervised
                        matrix used by the baseline).
  * tft_model.py     -- a TFT scaffold with a clearly marked plug-in point.
  * forecast_runner.py -- a leakage-safe quantile baseline (q10/q50/q90) that
                        runs anywhere, plus the orchestration that turns model
                        output into the final forecast table.
"""
