import pandas as pd

from src.experts.weather_expert import run


def test_run_fills_weather_risks_when_inputs_are_missing():
    weather_raw = pd.DataFrame(
        [
            {
                "port_id": "CHENNAI",
                "date": "2026-03-01",
                "storm_flag": 1.0,
                "wind_speed": None,
                "rainfall": None,
                "wave_height": None,
                "visibility": None,
            }
        ]
    )
    weather_raw["date"] = pd.to_datetime(weather_raw["date"])

    out = run(weather_raw)

    assert not out.empty
    assert out[["wind_risk", "rain_risk", "wave_risk", "storm_risk", "WxImpactIndex"]].notna().all().all()
    assert (out[["wind_risk", "rain_risk", "wave_risk", "storm_risk", "WxImpactIndex"]] >= 0).all().all()
