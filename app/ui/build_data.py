"""Bridge: pipeline outputs -> app/ui/data.json (what the 3D scene reads).

Run AFTER run_demo has produced outputs/ (forecasts, regimes, decisions).
Then serve the UI:  cd app/ui && python -m http.server 8000

It reads the real model output and writes one data.json so the 3D map shows
REAL forecasts/regimes/recommendations instead of the embedded sample.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs"
HERE = Path(__file__).resolve().parent

# port_id -> (display name, lat, lon, region)
PORTS = {
    "DEENDAYAL": ("Deendayal (Kandla)", 23.02, 70.22, "West"),
    "KANDLA": ("Deendayal (Kandla)", 23.02, 70.22, "West"),
    "MUNDRA": ("Mundra (APSEZ)", 22.74, 69.70, "West"),
    "APSEZ": ("Mundra (APSEZ)", 22.74, 69.70, "West"),
    "JNPT": ("Jawaharlal Nehru (Nhava Sheva)", 18.95, 72.95, "West"),
    "MUMBAI": ("Mumbai Port", 18.96, 72.84, "West"),
    "MORMUGAO": ("Mormugao (Goa)", 15.40, 73.80, "West"),
    "NEW_MANGALORE": ("New Mangalore", 12.92, 74.80, "West"),
    "HAZIRA": ("Hazira", 21.10, 72.62, "West"),
    "COCHIN": ("Cochin", 9.97, 76.27, "South"),
    "TUTICORIN": ("V.O. Chidambaranar (Tuticorin)", 8.75, 78.20, "South"),
    "CHENNAI": ("Chennai", 13.10, 80.30, "East"),
    "KAMARAJAR": ("Kamarajar (Ennore)", 13.25, 80.33, "East"),
    "KATTUPALLI": ("Kattupalli", 13.28, 80.33, "East"),
    "KRISHNAPATNAM": ("Krishnapatnam", 14.27, 80.12, "East"),
    "VIZAG": ("Visakhapatnam", 17.69, 83.22, "East"),
    "PARADIP": ("Paradip", 20.26, 86.67, "East"),
    "KOLKATA": ("Kolkata / Haldia", 22.55, 88.31, "East"),
    "HALDIA": ("Haldia", 22.07, 88.10, "East"),
}


def _read(p):
    return pd.read_csv(p) if p.exists() else pd.DataFrame()


def generate():
    fc = _read(OUT / "forecasts" / "forecast_table.csv")
    rg = _read(OUT / "regimes" / "regimes.csv")
    dc = _read(OUT / "forecasts" / "decisions.csv")
    var = _read(OUT / "analytics" / "value_at_risk.csv")
    lg = _read(OUT / "analytics" / "league_table.csv")
    if fc.empty:
        raise SystemExit("No outputs/forecasts/forecast_table.csv — run run_demo first.")

    rg_last = (rg.assign(date=pd.to_datetime(rg["date"])).sort_values("date")
               .groupby("port_id").tail(1).set_index("port_id")) if not rg.empty else pd.DataFrame()
    var_i = var.set_index("port_id") if not var.empty else pd.DataFrame()
    lg_i = lg.set_index("port_id") if not lg.empty else pd.DataFrame()

    ports = []
    for pid, g in fc.groupby("port_id"):
        meta = PORTS.get(str(pid).upper())
        if not meta:
            continue
        g = g.sort_values("horizon_day")
        name, lat, lon, region = meta
        risk = g["risk_level"].mode()
        regime = "CONGESTED"; rem = None; cp = None
        if pid in getattr(rg_last, "index", []):
            r = rg_last.loc[pid]
            regime = str(r["regime_label"]); rem = round(float(r["expected_remaining_days"]), 1)
        if not dc.empty:
            d = dc[dc["port_id"] == pid]
            if not d.empty:
                cp = round(float(d["congestion_probability"].mean()), 2)
                rec = str(d["operational_adjustment"].mode().iloc[0]) if "operational_adjustment" in d else ""
            else:
                rec = ""
        else:
            rec = ""
        ports.append({
            "id": pid, "name": name, "lat": lat, "lon": lon, "region": region,
            "regime": regime,
            "risk": risk.iloc[0] if not risk.empty else "Medium",
            "peak_q90": round(float(g["q90"].max()), 0),
            "exp_remaining": rem, "congestion_prob": cp,
            "dwell_days": round(float(g["predicted_delay"].mean()) / 24, 1)
            if g["predicted_delay"].notna().any() else None,
            "cargo_mt": round(float(lg_i.loc[pid, "cargo_mt"]), 1)
            if pid in getattr(lg_i, "index", []) and "cargo_mt" in lg_i.columns else None,
            "value_at_risk": round(float(var_i.loc[pid, "value_at_risk_inr_cr"]), 0)
            if pid in getattr(var_i, "index", []) and "value_at_risk_inr_cr" in var_i.columns else None,
            "rec": rec or "Monitor conditions.",
            "forecast": [{"h": int(r.horizon_day), "q10": round(float(r.q10), 0),
                          "q50": round(float(r.q50), 0), "q90": round(float(r.q90), 0),
                          "delay": round(float(r.predicted_delay), 0)
                          if pd.notna(r.predicted_delay) else None}
                         for r in g.itertuples()],
        })

    # merge REAL IMF PortWatch activity (vessel calls + import/export trade)
    pw = _read(ROOT / "data" / "portwatch" / "port_activity_summary.csv")
    if not pw.empty:
        pwi = pw.set_index("canon")
        for p in ports:
            if p["id"] in pwi.index:
                r = pwi.loc[p["id"]]
                if hasattr(r, "iloc") and getattr(r, "ndim", 1) > 1:
                    r = r.iloc[0]
                p["portcalls"] = int(r.get("portcalls", 0) or 0)
                p["import_tonnes"] = int(r.get("import_tonnes", 0) or 0)
                p["export_tonnes"] = int(r.get("export_tonnes", 0) or 0)
                p["containers"] = int(r.get("containers", 0) or 0)
                if pd.notna(r.get("lat")):
                    p["lat"] = float(r["lat"]); p["lon"] = float(r["lon"])

    econ = _read(ROOT / "data" / "preprocessed" / "final_economic_features.csv")
    economic = {}
    if not econ.empty:
        last = econ.iloc[-1]
        economic = {"lsci": round(float(last.get("Global_LSCI", 0)), 1),
                    "iip": round(float(last.get("IIP_Value", 0)), 1),
                    "trend": "live", "freight": "—"}

    payload = {"ports": ports, "economic": economic,
               "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M")}
    (HERE / "data.json").write_text(json.dumps(payload), encoding="utf-8")
    print(f"wrote {HERE/'data.json'} ({len(ports)} ports)")


if __name__ == "__main__":
    generate()
