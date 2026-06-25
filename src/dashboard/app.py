"""Interactive Streamlit dashboard for the India Maritime Logistics Forecast.

Reads the artefacts written by `run_demo.py` (outputs/) and presents:
  * a national port-risk map,
  * congestion gauges and a 10-day quantile forecast band,
  * the operational regime timeline,
  * decision-layer signals + route/reroute recommendations,
  * a model benchmark view.

Run from the project root:
    streamlit run src/dashboard/app.py

Streamlit/Plotly are imported lazily so importing this module never breaks the
core pipeline.
"""

from __future__ import annotations

import sys
from pathlib import Path

# `streamlit run` only puts this file's folder on sys.path; add the project root
# so `import src...` resolves.
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import pandas as pd

from src.utils.config import (FORECASTS_DIR, REGIMES_DIR, EXPERT_FEATURES_DIR,
                              ANALYTICS_DIR, PORT_ID)

_REGIME_COLORS = {"NORMAL": "#21e6c1", "CONGESTED": "#ffb020", "SEVERE": "#ff3b6b"}
_RISK_COLORS = {"Low": "#21e6c1", "Medium": "#ffb020", "High": "#ff3b6b",
                "Unknown": "#5b7c9e"}

_THEME_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
.stApp{background:#05080f;color:#bfe9ff;}
.stApp, .stApp p, .stApp span, .stApp div{font-family:'Space Grotesk',system-ui,sans-serif;}
h1,h2,h3,h4{color:#eaf7ff!important;font-family:'Space Grotesk',sans-serif!important;letter-spacing:.3px;}
section[data-testid="stSidebar"]{background:#070b16;border-right:1px solid rgba(47,167,255,.18);}
.pw-hero{padding:6px 0 2px;}
.pw-logo{font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:700;color:#21e6c1;letter-spacing:3px;}
.pw-sub{font-family:'JetBrains Mono',monospace;font-size:11px;color:#5b7c9e;letter-spacing:4px;margin-top:2px;}
.pw-pipe{display:flex;gap:10px;align-items:center;margin:10px 0 18px;flex-wrap:wrap;
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1px;}
.pw-pipe span{padding:4px 12px;border:1px solid rgba(47,167,255,.25);border-radius:3px;color:#7f9bc0;background:rgba(10,18,34,.6);}
.pw-pipe span.on{color:#04070f;background:#21e6c1;border-color:#21e6c1;font-weight:600;}
.pw-pipe i{color:#33506f;font-style:normal;}
div[data-testid="stMetric"]{background:rgba(10,18,34,.7);border:1px solid rgba(47,167,255,.2);
  border-radius:8px;padding:12px 14px;}
div[data-testid="stMetricValue"]{color:#eaf7ff;font-family:'JetBrains Mono',monospace;}
div[data-testid="stMetricLabel"]{color:#5b7c9e;letter-spacing:1px;}
.stTabs [data-baseweb="tab-list"]{gap:4px;border-bottom:1px solid rgba(47,167,255,.18);}
.stTabs [data-baseweb="tab"]{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:1px;
  color:#7f9bc0;background:transparent;}
.stTabs [aria-selected="true"]{color:#21e6c1!important;border-bottom:2px solid #21e6c1;}
.stDataFrame{border:1px solid rgba(47,167,255,.15);border-radius:8px;}
.stButton>button{background:#21e6c1;color:#04070f;border:none;border-radius:4px;
  font-family:'JetBrains Mono',monospace;font-weight:600;letter-spacing:1px;}
.stButton>button:hover{background:#3ff0cf;color:#04070f;}
</style>
"""


def _read(path: Path) -> pd.DataFrame:
    if path.exists():
        df = pd.read_csv(path)
        for c in ("date", "target_date", "forecast_origin_date"):
            if c in df.columns:
                df[c] = pd.to_datetime(df[c], errors="coerce")
        return df
    return pd.DataFrame()


def _port_coords():
    from src.decision.route_optimizer import PORT_COORDS
    return PORT_COORDS


_NEON = ["#21e6c1", "#2fa7ff", "#ffb020", "#ff3b6b", "#9b6bff", "#1d9e75"]


def _dark(fig):
    """Apply the neon/dark theme to a Plotly figure."""
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(10,18,34,0.45)",
        font=dict(color="#bfe9ff", family="JetBrains Mono, monospace", size=12),
        colorway=_NEON, margin=dict(t=36, l=10, r=10, b=10),
        legend=dict(font=dict(color="#7f9bc0")),
        title_font_color="#eaf7ff")
    fig.update_xaxes(gridcolor="rgba(47,167,255,0.12)", zerolinecolor="rgba(47,167,255,0.2)",
                     color="#7f9bc0")
    fig.update_yaxes(gridcolor="rgba(47,167,255,0.12)", zerolinecolor="rgba(47,167,255,0.2)",
                     color="#7f9bc0")
    return fig


def _ticker(col, df, value_col, label, prefix=""):
    if df is None or df.empty or value_col not in df.columns:
        col.metric(label, "n/a")
        return
    s = df[value_col].astype(float)
    last = s.iloc[-1]
    prev = s.iloc[-2] if len(s) > 1 else last
    chg = (last - prev) / prev * 100 if prev else 0.0
    col.metric(label, f"{prefix}{last:,.2f}", f"{chg:+.2f}%")


def _port_view_df(forecast, regimes, decisions):
    """One row per port with everything needed for the map hover + cards."""
    from src.decision.route_optimizer import PORT_COORDS
    from src.utils.config import PORT_BY_ID
    import numpy as np
    rows = []
    for pid in forecast[PORT_ID].unique():
        f = forecast[forecast[PORT_ID] == pid]
        risk = f["risk_level"].mode()
        delay = f["predicted_delay"]
        reg, rem, dis = "—", float("nan"), 0
        if regimes is not None and not regimes.empty:
            rp = regimes[regimes[PORT_ID] == pid].sort_values("date")
            if not rp.empty:
                reg = str(rp["regime_label"].iloc[-1])
                rem = float(rp["expected_remaining_days"].iloc[-1])
                dis = int(rp["days_in_state"].iloc[-1])
        prob = float("nan")
        if decisions is not None and not decisions.empty:
            d = decisions[decisions[PORT_ID] == pid]
            if not d.empty:
                prob = float(d["congestion_probability"].mean())
        lat, lon = PORT_COORDS.get(pid, (None, None))
        if lat is None:
            continue
        rows.append({
            "port_id": pid,
            "name": PORT_BY_ID[pid].name if pid in PORT_BY_ID else pid,
            "region": PORT_BY_ID[pid].region if pid in PORT_BY_ID else "",
            "lat": lat, "lon": lon, "regime": reg,
            "peak_q50": round(float(f["q50"].max()), 1),
            "peak_q90": round(float(f["q90"].max()), 1),
            "risk": risk.iloc[0] if not risk.empty else "Unknown",
            "delay": round(float(delay.max()), 1) if delay.notna().any() else None,
            "exp_remaining": round(rem, 1) if rem == rem else None,
            "days_in_state": dis,
            "congestion_prob": round(prob, 2) if prob == prob else None,
        })
    df = pd.DataFrame(rows)
    lg = _read(ANALYTICS_DIR / "league_table.csv")
    if not lg.empty:
        cols = [c for c in ["port_id", "cargo_mt", "turnaround_days",
                            "efficiency_score"] if c in lg.columns]
        df = df.merge(lg[cols], on="port_id", how="left")
    var = _read(ANALYTICS_DIR / "value_at_risk.csv")
    if not var.empty and "value_at_risk_inr_cr" in var.columns:
        df = df.merge(var[["port_id", "value_at_risk_inr_cr"]], on="port_id", how="left")
    return df


def _india_map_fig(df):
    import plotly.graph_objects as go
    import numpy as np
    from src.ingestion.connectors.portwatch import CHOKEPOINTS

    for c in ["cargo_mt", "turnaround_days", "efficiency_score",
              "value_at_risk_inr_cr"]:
        if c not in df.columns:
            df[c] = np.nan
    base = df["cargo_mt"].fillna(df["peak_q90"])
    sizes = 14 + 34 * (base - base.min()) / (base.max() - base.min() + 1e-9)
    colors = [_REGIME_COLORS.get(r, "#5b7c9e") for r in df["regime"]]
    custom = np.stack([
        df["regime"], df["risk"], df["peak_q50"], df["peak_q90"],
        df["delay"].fillna(-1), df["exp_remaining"].fillna(-1),
        df["congestion_prob"].fillna(-1), df["cargo_mt"].fillna(-1),
        df["turnaround_days"].fillna(-1), df["efficiency_score"].fillna(-1),
        df["value_at_risk_inr_cr"].fillna(-1)], axis=-1)
    ht = ("<b>%{text}</b><br>"
          "Regime: %{customdata[0]} &nbsp;|&nbsp; Risk: %{customdata[1]}<br>"
          "Congestion q50/q90: %{customdata[2]} / %{customdata[3]}<br>"
          "Peak delay: %{customdata[4]} h &nbsp; Expected remain: %{customdata[5]} d<br>"
          "P(congested): %{customdata[6]}<br>"
          "Cargo: %{customdata[7]} MT &nbsp; Turnaround: %{customdata[8]} d<br>"
          "Efficiency: %{customdata[9]}/100 &nbsp; Value-at-risk: ₹%{customdata[10]} cr"
          "<extra></extra>")
    # Plotly 6 prefers Scattermap (MapLibre); fall back to Scattermapbox on 5.x.
    use_map = hasattr(go, "Scattermap")
    Trace = go.Scattermap if use_map else go.Scattermapbox
    fig = go.Figure(Trace(
        lat=df["lat"], lon=df["lon"], text=df["name"], customdata=custom,
        mode="markers", hovertemplate=ht,
        marker=dict(size=sizes, color=colors, opacity=0.9)))
    ck = [(m["name"], m["lat"], m["lon"]) for m in CHOKEPOINTS.values()
          if m["lat"] and 0 < m["lat"] < 30]
    if ck:
        fig.add_trace(Trace(
            lat=[c[1] for c in ck], lon=[c[2] for c in ck],
            text=[c[0] for c in ck], mode="markers+text",
            textposition="top right", textfont=dict(color="#ff3b6b", size=10),
            marker=dict(size=11, color="#ff3b6b"),
            hovertemplate="<b>%{text}</b><br>chokepoint<extra></extra>"))
    map_conf = dict(style="carto-darkmatter", center=dict(lat=19, lon=80), zoom=3.4)
    common = dict(height=640, margin=dict(l=0, r=0, t=0, b=0),
                  paper_bgcolor="rgba(0,0,0,0)", showlegend=False,
                  font=dict(color="#bfe9ff", family="JetBrains Mono, monospace"))
    fig.update_layout(map=map_conf, **common) if use_map else \
        fig.update_layout(mapbox=map_conf, **common)
    return fig


def _port_cards_html(df):
    cards = []
    for _, r in df.sort_values("peak_q90", ascending=False).iterrows():
        col = _REGIME_COLORS.get(r["regime"], "#5b7c9e")
        rk = _RISK_COLORS.get(r["risk"], "#5b7c9e")
        cargo = f"{r['cargo_mt']:.1f}" if r.get("cargo_mt") == r.get("cargo_mt") else "—"
        var = (f"₹{r['value_at_risk_inr_cr']:.0f} cr"
               if r.get("value_at_risk_inr_cr") == r.get("value_at_risk_inr_cr") else "—")
        cards.append(f"""
        <div style="background:rgba(10,18,34,.7);border:1px solid {col}55;
          border-left:3px solid {col};border-radius:10px;padding:12px 14px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:13px;color:#eaf7ff;
            font-weight:600;letter-spacing:.5px;">{r['name']}</div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <span style="font-size:10px;color:{col};border:1px solid {col};border-radius:3px;
              padding:1px 7px;">{r['regime']}</span>
            <span style="font-size:10px;color:{rk};border:1px solid {rk};border-radius:3px;
              padding:1px 7px;">{r['risk']}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:10px;
            font-family:'JetBrains Mono',monospace;">
            <div><div style="font-size:9px;color:#5b7c9e;">CONGEST P90</div>
              <div style="font-size:18px;color:#eaf7ff;">{r['peak_q90']:.0f}</div></div>
            <div><div style="font-size:9px;color:#5b7c9e;">REMAIN</div>
              <div style="font-size:18px;color:#eaf7ff;">{(str(r['exp_remaining'])+'d') if r.get('exp_remaining')==r.get('exp_remaining') else '—'}</div></div>
            <div><div style="font-size:9px;color:#5b7c9e;">CARGO MT</div>
              <div style="font-size:18px;color:#eaf7ff;">{cargo}</div></div>
          </div>
          <div style="margin-top:8px;font-size:10px;color:#7f9bc0;">value-at-risk {var}</div>
        </div>""")
    return ('<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));'
            'gap:12px;margin-top:14px;">' + "".join(cards) + "</div>")


def _port_params(port, forecast, regimes):
    f = forecast[forecast[PORT_ID] == port]
    cur = "CONGESTED"
    if regimes is not None and not regimes.empty:
        rp = regimes[regimes[PORT_ID] == port].sort_values("date")
        if not rp.empty:
            cur = str(rp["regime_label"].iloc[-1])
    rmode = f["risk_level"].mode()
    q50 = float(f["q50"].max()) if not f.empty else 60.0
    return {"port": port, "congestion": round(q50, 1),
            "risk": rmode.iloc[0] if not rmode.empty else "Medium",
            "regime": cur, "anchored": int(2 + q50 * 0.08)}


def _embed_views(st, port, forecast, regimes, height=420, tag=""):
    import json as _json
    import streamlit.components.v1 as _comp
    params = _port_params(port, forecast, regimes)
    here = Path(__file__).resolve().parent
    st.markdown(f"#### {port}: approach control & holographic port")
    rc, sc = st.columns(2)
    radar = here / "atc_radar.html"
    ship = here / "ship_3d.html"
    # a per-location comment keeps each embed's component ID unique across tabs
    u = f"<!--{tag}-->"
    if radar.exists():
        with rc:
            _comp.html(u + f"<script>window.RADAR_PARAMS={_json.dumps(params)};</script>"
                       + radar.read_text(encoding="utf-8"), height=height)
    if ship.exists():
        with sc:
            _comp.html(u + f"<script>window.SHIP_PARAMS={_json.dumps(params)};</script>"
                       + ship.read_text(encoding="utf-8"), height=height)


def _data_sources_panel(st):
    """Sidebar LIVE/SYNTHETIC readiness panel (data transparency)."""
    import json as _json
    p = ANALYTICS_DIR / "provenance.json"
    if not p.exists():
        return
    try:
        payload = _json.loads(p.read_text())
    except Exception:
        return
    srcs = payload.get("sources", {})
    if not srcs:
        return
    readiness = int(payload.get("readiness", 0) * 100)
    st.sidebar.markdown(
        f"<div style='margin-top:14px;font-family:JetBrains Mono,monospace;"
        f"font-size:11px;color:#5b7c9e;letter-spacing:2px;'>DATA READINESS "
        f"<span style='color:#21e6c1;'>{readiness}%</span></div>",
        unsafe_allow_html=True)
    dot = {"live": "#21e6c1", "cache": "#2fa7ff", "synthetic": "#ff5a72"}
    rows = []
    for name, meta in srcs.items():
        c = dot.get(meta.get("status"), "#5b7c9e")
        rows.append(
            f"<div style='display:flex;align-items:center;gap:7px;margin:5px 0;"
            f"font-size:11px;color:#9fb6cc;'>"
            f"<span style='width:8px;height:8px;border-radius:50%;background:{c};"
            f"display:inline-block;'></span>{name} "
            f"<span style='margin-left:auto;color:{c};text-transform:uppercase;"
            f"font-size:9px;'>{meta.get('status')}</span></div>")
    st.sidebar.markdown("".join(rows), unsafe_allow_html=True)


def _handle_map_click(st, sel, pv, current_port):
    """If the user clicked a port marker on the map, sync all tabs to it."""
    pts = []
    try:
        pts = sel.selection.points
    except Exception:
        if isinstance(sel, dict):
            pts = sel.get("selection", {}).get("points", [])
    if not pts:
        return
    p0 = pts[0]
    cn = p0.get("curve_number", p0.get("curveNumber", 0))
    idx = p0.get("point_index", p0.get("point_number", p0.get("pointNumber")))
    if cn == 0 and idx is not None and int(idx) < len(pv):
        clicked = pv.iloc[int(idx)]["port_id"]
        if clicked != current_port:
            st.session_state.pending_port = clicked
            st.rerun()


def main():  # pragma: no cover - requires streamlit + generated outputs
    import streamlit as st
    import plotly.graph_objects as go

    st.set_page_config(page_title="India PortWatch", layout="wide")
    st.markdown(_THEME_CSS, unsafe_allow_html=True)
    st.markdown(
        '<div class="pw-hero"><div class="pw-logo">&#9672; INDIA PORTWATCH</div>'
        '<div class="pw-sub">PREDICTIVE PORT INTELLIGENCE</div></div>',
        unsafe_allow_html=True)
    st.markdown(
        '<div class="pw-pipe"><span>DATA</span><i>&rarr;</i><span>EXPERTS</span>'
        '<i>&rarr;</i><span class="on">HSMM &middot; REGIME</span><i>&rarr;</i>'
        '<span class="on">TFT &middot; FORECAST</span><i>&rarr;</i>'
        '<span>DECISION</span><i>&rarr;</i><span>ANALYTICS</span></div>',
        unsafe_allow_html=True)

    forecast = _read(FORECASTS_DIR / "forecast_table.csv")
    regimes = _read(REGIMES_DIR / "regimes.csv")
    decisions = _read(FORECASTS_DIR / "decisions.csv")
    routes = _read(FORECASTS_DIR / "route_recommendations.csv")
    port_rep = _read(FORECASTS_DIR / "port_manager_report.csv")
    ship_rep = _read(FORECASTS_DIR / "ship_manager_report.csv")
    benchmark = _read(FORECASTS_DIR / "benchmark_comparison.csv")

    if forecast.empty:
        st.warning("No outputs found. Run `python run_demo.py` first.")
        return

    model_used = forecast["model"].iloc[0] if "model" in forecast.columns else "baseline"
    st.sidebar.metric("Forecast model", model_used.upper())
    ports = sorted(forecast[PORT_ID].unique())
    # click-to-select: a map click stashes the port here before the widget is built
    if "pending_port" in st.session_state:
        st.session_state.port_select = st.session_state.pop("pending_port")
    port = st.sidebar.selectbox("Port", ports, key="port_select")
    _data_sources_panel(st)
    tab_geo, tab_term, tab_an, tab_map, tab_port, tab_ship, tab_bench = st.tabs(
        ["India Ports", "Terminal", "Analytics", "Network", "Port manager",
         "Ship manager", "Benchmark"])

    with tab_geo:
        st.subheader("India ports — live operational map")
        st.caption("Marker size = cargo throughput · colour = HSMM regime · "
                   "hover any port for its full forecast & analytics")
        pv = _port_view_df(forecast, regimes, decisions)
        if pv.empty:
            st.info("No forecast data. Run `python run_demo.py --analytics` first.")
        else:
            n_sev = int((pv["regime"] == "SEVERE").sum())
            n_con = int((pv["regime"] == "CONGESTED").sum())
            m = st.columns(4)
            m[0].metric("Ports tracked", len(pv))
            m[1].metric("In SEVERE regime", n_sev)
            m[2].metric("In CONGESTED regime", n_con)
            if "value_at_risk_inr_cr" in pv.columns and pv["value_at_risk_inr_cr"].notna().any():
                m[3].metric("Total value-at-risk", f"₹{pv['value_at_risk_inr_cr'].sum():,.0f} cr")
            sel = st.plotly_chart(_india_map_fig(pv), use_container_width=True,
                                  key="india_map", on_select="rerun",
                                  selection_mode="points")
            _handle_map_click(st, sel, pv, port)
            _embed_views(st, port, forecast, regimes, height=400, tag="geo")
            st.markdown(_port_cards_html(pv), unsafe_allow_html=True)

    fp = forecast[forecast[PORT_ID] == port].sort_values("horizon_day")

    # --------------------------------------------------------------- Terminal
    with tab_term:
        import json
        import streamlit.components.v1 as components

        choke = _read(FORECASTS_DIR / "chokepoints.csv")
        brent = _read(FORECASTS_DIR / "market_brent.csv")
        freight = _read(FORECASTS_DIR / "market_freight.csv")
        events = _read(FORECASTS_DIR / "events.csv")

        st.subheader("Market tickers")
        cols = st.columns(3)
        _ticker(cols[0], brent, "brent_usd", "Brent crude", "$")
        _ticker(cols[1], freight, "freight_index", "Freight index", "")
        peak = float(fp["q90"].max()) if not fp.empty else float("nan")
        cols[2].metric(f"{port} peak congestion (P90)", f"{peak:.0f}/100")

        # Approach-control radar + holographic 3D port, both driven by the forecast
        _embed_views(st, port, forecast, regimes, height=460, tag="term")

        st.subheader("Chokepoint watchlist")
        if not choke.empty:
            latest = (choke.sort_values("date").groupby("name").tail(1)
                      [["name", "transit_calls", "vs_baseline_pct", "status"]]
                      .reset_index(drop=True))
            st.dataframe(latest, use_container_width=True)

        st.subheader("Geopolitical alerts")
        if not events.empty:
            for _, e in events.sort_values("severity", ascending=False).head(8).iterrows():
                sev = float(e.get("severity", 0))
                icon = "🔴" if sev >= 0.7 else "🟠" if sev >= 0.5 else "🟡"
                st.write(f"{icon} **{e.get('shock_type','event')}** "
                         f"({sev:.0%}) — {e.get('title','')}  ·  _{e.get('source','')}_")

        st.subheader("What-if scenario simulator")
        try:
            from src.decision import scenario_engine as se
            preset = st.selectbox("Shock scenario", list(se.PRESETS.keys()))
            if st.button("▶ Simulate shock"):
                res = se.run_preset(preset, forecast)
                m1, m2 = st.columns(2)
                m1.metric("Brent impact", f"{res.oil_pct:+.1f}%")
                m2.metric("Freight impact", f"{res.freight_pct:+.1f}%")
                st.info(res.briefing)
                st.dataframe(res.affected_ports, use_container_width=True)
                # before/after for the selected port
                af = res.adjusted_forecast
                ap = af[af[PORT_ID] == port].sort_values("horizon_day")
                if not ap.empty and not fp.empty:
                    import plotly.graph_objects as go2
                    fig = go2.Figure()
                    fig.add_trace(go2.Scatter(x=fp["horizon_day"], y=fp["q50"],
                                              name="baseline q50",
                                              line=dict(color="#3b7ddd")))
                    fig.add_trace(go2.Scatter(x=ap["horizon_day"], y=ap["q50"],
                                              name="shock-adjusted q50",
                                              line=dict(color="#d7263d", dash="dash")))
                    fig.update_layout(height=320, xaxis_title="Horizon day",
                                      yaxis_title="Congestion", margin=dict(t=10))
                    st.plotly_chart(_dark(fig), use_container_width=True,
                                    key="scenario_ba")
        except Exception as exc:
            st.warning(f"Scenario simulator unavailable: {exc}")

    # --------------------------------------------------------------- Analytics
    with tab_an:
        import json
        import plotly.express as px

        adir = ANALYTICS_DIR
        ns_path = adir / "national_summary.json"
        if ns_path.exists():
            ns = json.loads(ns_path.read_text())
            c = st.columns(4)
            c[0].metric("Annualised cargo (MT)", f"{ns.get('annualised_cargo_mt','-'):,}")
            c[1].metric("Cargo YoY", f"{ns.get('cargo_yoy_pct','-')}%")
            c[2].metric("Monthly TEU", f"{ns.get('monthly_teu','-'):,}")
            c[3].metric("Port concentration (HHI)", ns.get("port_concentration_hhi", "-"))
        else:
            st.info("Run `python run_demo.py --analytics` to populate analytics.")

        top = _read(adir / "top_ports.csv")
        coast = _read(adir / "coast_split.csv")
        cc1, cc2 = st.columns(2)
        if not top.empty:
            cc1.plotly_chart(_dark(px.bar(top, x="port_name", y="cargo_mt",
                                          title="Top ports by cargo (MT)",
                                          color_discrete_sequence=_NEON)),
                             use_container_width=True, key="an_top")
        if not coast.empty:
            cc2.plotly_chart(_dark(px.pie(coast, names="region", values="cargo_mt",
                                          title="Coast share of cargo",
                                          color_discrete_sequence=_NEON)),
                             use_container_width=True, key="an_coast")

        league = _read(adir / "league_table.csv")
        if not league.empty:
            st.subheader("Port league table & efficiency score")
            st.dataframe(league, use_container_width=True)

        nat_comm = _read(adir / "national_commodity_mix.csv")
        if not nat_comm.empty:
            st.subheader("National commodity mix")
            st.plotly_chart(_dark(px.bar(nat_comm, x="commodity", y="cargo_mt",
                                         color="commodity",
                                         title="Commodity composition (MT)",
                                         color_discrete_sequence=_NEON)),
                            use_container_width=True, key="an_commodity")

        dcol, fcol = st.columns(2)
        demand = _read(adir / "demand_index.csv")
        if not demand.empty:
            dcol.subheader("Demand index by port")
            dcol.dataframe(demand, use_container_width=True)
        var = _read(adir / "value_at_risk.csv")
        if not var.empty:
            fcol.subheader("Trade value-at-risk (INR cr)")
            total = var["value_at_risk_inr_cr"].sum()
            fcol.metric("Total value-at-risk", f"₹{total:,.0f} cr")
            fcol.dataframe(var, use_container_width=True)

        anomalies = _read(adir / "anomalies.csv")
        if not anomalies.empty:
            st.subheader("Detected anomalies (early warning)")
            st.dataframe(anomalies.tail(20), use_container_width=True)

        bt = _read(adir / "scenario_backtest.csv")
        if not bt.empty:
            st.subheader("Scenario model backtest vs real events")
            st.dataframe(bt, use_container_width=True)

    # ------------------------------------------------------------- Network map
    with tab_map:
        st.subheader("Port risk network")
        coords = _port_coords()
        peak = (forecast.groupby(PORT_ID)["q90"].max().reset_index())
        rows = []
        for _, r in peak.iterrows():
            pid = r[PORT_ID]
            lvl = forecast[forecast[PORT_ID] == pid]["risk_level"].mode()
            lvl = lvl.iloc[0] if not lvl.empty else "Unknown"
            lat, lon = coords.get(pid, (None, None))
            if lat is None:
                continue
            rows.append({"port": pid, "lat": lat, "lon": lon,
                         "peak_q90": r["q90"], "risk": lvl})
        mapdf = pd.DataFrame(rows)
        if not mapdf.empty:
            fig = go.Figure(go.Scattergeo(
                lat=mapdf["lat"], lon=mapdf["lon"], text=mapdf["port"],
                mode="markers+text", textposition="top center",
                textfont=dict(color="#bfe9ff", family="JetBrains Mono, monospace",
                              size=10),
                marker=dict(size=mapdf["peak_q90"] / 3 + 10,
                            color=[_RISK_COLORS.get(x, "#888") for x in mapdf["risk"]],
                            line=dict(width=1, color="#05080f"))))
            fig.update_geos(scope="asia", center=dict(lat=21, lon=80),
                            projection_scale=3.2, showcountries=True,
                            landcolor="#0a1626", oceancolor="#05080f",
                            showocean=True, countrycolor="rgba(47,167,255,0.25)",
                            bgcolor="rgba(0,0,0,0)", coastlinecolor="rgba(47,167,255,0.3)")
            fig.update_layout(height=460, margin=dict(l=0, r=0, t=10, b=0),
                              paper_bgcolor="rgba(0,0,0,0)",
                              font=dict(color="#bfe9ff"))
            st.plotly_chart(fig, use_container_width=True, key="network_map")
        st.dataframe(mapdf, use_container_width=True)

    # ------------------------------------------------------------ Port manager
    with tab_port:
        c1, c2, c3 = st.columns(3)
        peak_row = fp.loc[fp["q50"].idxmax()]
        c1.plotly_chart(_gauge(go, float(peak_row["q50"]),
                               "Peak congestion (q50)"), use_container_width=True,
                        key="g_cong")
        if fp["predicted_delay"].notna().any():
            c2.plotly_chart(_gauge(go, float(fp["predicted_delay"].max()),
                                   "Peak delay (hrs)", vmax=72),
                            use_container_width=True, key="g_delay")
        if not regimes.empty:
            rp = regimes[regimes[PORT_ID] == port]
            cur = rp.sort_values("date")["regime_label"].iloc[-1] if not rp.empty else "—"
            c3.metric("Current regime", cur)

        st.subheader(f"{port}: 1–10 day congestion forecast")
        st.plotly_chart(_band_chart(go, fp), use_container_width=True, key="pm_band")

        if not regimes.empty:
            st.subheader("Operational regime timeline (recent)")
            st.plotly_chart(_regime_timeline(go, regimes[regimes[PORT_ID] == port]),
                            use_container_width=True, key="pm_regime")

        if not decisions.empty:
            st.subheader("Decision layer")
            st.dataframe(decisions[decisions[PORT_ID] == port]
                         .sort_values("horizon_day"), use_container_width=True)
        if not port_rep.empty:
            st.subheader("Port-manager briefing")
            st.table(port_rep[port_rep[PORT_ID] == port].T.astype(str))

    # ------------------------------------------------------------ Ship manager
    with tab_ship:
        if not ship_rep.empty:
            st.subheader("Ship-manager summary")
            st.table(ship_rep[ship_rep[PORT_ID] == port].T.astype(str))
        if not routes.empty:
            st.subheader("Route / reroute recommendations (fleet)")
            st.dataframe(routes, use_container_width=True)
            for _, r in routes.iterrows():
                flag = "🔀" if r.get("reroute") else "✅"
                st.write(f"{flag} {r['recommendation']}")

    # --------------------------------------------------------------- Benchmark
    with tab_bench:
        if benchmark.empty:
            st.info("Run `python run_demo.py --benchmark` to populate this view.")
        else:
            st.subheader("Model comparison (walk-forward, lower is better)")
            st.dataframe(benchmark, use_container_width=True)
            for metric in ["mae", "rmse"]:
                img = FORECASTS_DIR / f"benchmark_{metric}.png"
                if img.exists():
                    st.image(str(img))
        fi = FORECASTS_DIR / "baseline_feature_importance.png"
        if fi.exists():
            st.subheader("What drives the forecast (feature importance)")
            st.image(str(fi))


def _gauge(go, value, title, vmax=100):
    return go.Figure(go.Indicator(
        mode="gauge+number", value=value, title={"text": title},
        gauge={"axis": {"range": [0, vmax]},
               "bar": {"color": "#3b7ddd"},
               "steps": [{"range": [0, vmax * 0.4], "color": "#d7f0db"},
                         {"range": [vmax * 0.4, vmax * 0.7], "color": "#fdebc0"},
                         {"range": [vmax * 0.7, vmax], "color": "#f7c5c5"}]}
    )).update_layout(height=240, margin=dict(l=20, r=20, t=50, b=10),
                     paper_bgcolor="rgba(0,0,0,0)",
                     font=dict(color="#bfe9ff", family="JetBrains Mono, monospace"))


def _band_chart(go, fp):
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=fp["horizon_day"], y=fp["q90"], name="q90",
                             line=dict(width=0), showlegend=False))
    fig.add_trace(go.Scatter(x=fp["horizon_day"], y=fp["q10"], name="80% band",
                             fill="tonexty", fillcolor="rgba(59,125,221,0.2)",
                             line=dict(width=0)))
    fig.add_trace(go.Scatter(x=fp["horizon_day"], y=fp["q50"], name="q50 (median)",
                             line=dict(color="#3b7ddd", width=3)))
    fig.update_layout(height=380, xaxis_title="Horizon day (+)",
                      yaxis_title="Congestion index", margin=dict(t=10))
    return _dark(fig)


def _regime_timeline(go, rp):
    rp = rp.sort_values("date").tail(90)
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=rp["date"], y=rp.get("p_severe", 0), name="P(severe)",
        stackgroup="one", line=dict(width=0.5, color=_REGIME_COLORS["SEVERE"])))
    fig.add_trace(go.Scatter(
        x=rp["date"], y=rp.get("p_congested", 0), name="P(congested)",
        stackgroup="one", line=dict(width=0.5, color=_REGIME_COLORS["CONGESTED"])))
    fig.add_trace(go.Scatter(
        x=rp["date"], y=rp.get("p_normal", 0), name="P(normal)",
        stackgroup="one", line=dict(width=0.5, color=_REGIME_COLORS["NORMAL"])))
    fig.update_layout(height=300, yaxis_title="Regime probability",
                      margin=dict(t=10))
    return _dark(fig)


if __name__ == "__main__":
    main()
