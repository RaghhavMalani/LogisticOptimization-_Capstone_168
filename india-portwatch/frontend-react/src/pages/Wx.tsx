/* WX <PORT> — weather intelligence report. */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, WxReport, fmt } from "../api";
import { Badge, KV, Panel } from "../ui";

function D({ k, v, u = "", tone = "" }: { k: string; v: React.ReactNode; u?: string; tone?: string }) {
  return <div className="datum"><div className="k">{k}</div>
    <div className={`v ${tone}`}>{v}</div>{u && <div className="u">{u}</div>}</div>;
}

export default function Wx({ setMode }: { setMode: (m: string) => void }) {
  const { portId = "JNPT" } = useParams();
  const [wx, setWx] = useState<WxReport | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setWx(null);
    api.wx(portId.toUpperCase())
      .then((r) => { setWx(r.data); setMode(r.data_mode); })
      .catch((e) => setErr(String(e)));
  }, [portId]);
  if (err) return <div className="panel mono" style={{ color: "var(--red)" }}>{err}</div>;
  if (!wx) return <div className="loading">WX {portId.toUpperCase()} ...</div>;
  const tone = (x: number, lo: number, hi: number) => (x >= hi ? "red" : x >= lo ? "amber" : "");
  return (
    <>
      <div className="page-head">
        <div><div className="page-title">WEATHER INTELLIGENCE</div>
          <h1>WX {wx.port_id}</h1>
          <div className="sub mono">{wx.mode} · as of {wx.as_of}</div></div>
        <Badge level={wx.cyclone_risk === "ACTIVE" ? "HIGH" : wx.cyclone_risk === "WATCH" ? "MEDIUM" : "LOW"} />
      </div>

      <div className="terminal-grid">
        <div>
          <div className="weather-scene">
            <div className="scene-readout">
              <div className="small">WIND FIELD / PRECIPITATION / SEA STATE</div>
              <div className="big">{fmt.n1(wx.wind_kt)} kt</div>
              <div className="small">{wx.wind_dir} / rainfall {fmt.n1(wx.rainfall_mm)} mm / wave {fmt.n1(wx.wave_m)} m</div>
            </div>
            <div className="storm-core" />
          </div>
          <div className="terminal-band mt">
            <span className="label">COMMAND</span><strong>WX {wx.port_id}</strong>
            <span className="label">CYCLONE/STORM RISK</span><strong>{wx.cyclone_risk}</strong>
            <span className="label">CONFIDENCE</span><strong>{wx.weather_confidence.toFixed(2)}</strong>
          </div>
          <div className="wx-grid mt">
            <D k="Wind speed" v={fmt.n1(wx.wind_kt)} u={`kt ${wx.wind_dir}`} tone={tone(wx.wind_kt, 20, 30)} />
            <D k="Rainfall 24h" v={fmt.n1(wx.rainfall_mm)} u="mm" tone={tone(wx.rainfall_mm, 25, 60)} />
            <D k="Wave height" v={fmt.n1(wx.wave_m)} u="m" tone={tone(wx.wave_m, 2, 3)} />
            <D k="Visibility" v={fmt.n1(wx.visibility_km)} u="km" tone={wx.visibility_km < 4 ? "red" : ""} />
            <D k="Cyclone / storm risk" v={wx.cyclone_risk}
              tone={wx.cyclone_risk === "ACTIVE" ? "red" : wx.cyclone_risk === "WATCH" ? "amber" : ""} />
            <D k="Weather persistence" v={wx.weather_persistence.toFixed(2)} u="7-day signal" />
            <D k="Weather shock" v={wx.weather_shock.toFixed(2)} tone={tone(wx.weather_shock, 0.15, 0.3)} />
            <D k="Weather impact score" v={wx.weather_impact_score.toFixed(2)} u="0-1"
              tone={tone(wx.weather_impact_score, 0.3, 0.6)} />
          </div>
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
        <Panel title="Model couplings">
          <KV k="weather_hsmm_input" v={wx.weather_hsmm_input.toFixed(2)} />
          <KV k="weather_tft_covariate" v={wx.weather_tft_covariate.toFixed(2)} />
          <KV k="weather_confidence" v={wx.weather_confidence.toFixed(2)} />
          <div className="spark-note">Weather Expert feeds the HSMM emission vector and the TFT future-known covariate.</div>
        </Panel>
        <Panel title="Interpretation">
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Impact {wx.weather_impact_score < 0.3 ? "LOW" : wx.weather_impact_score < 0.6 ? "MODERATE" : "HIGH"}:{" "}
            {wx.weather_impact_score < 0.3
              ? "weather is not a binding constraint on operations."
              : wx.weather_impact_score < 0.6
              ? "monitor pilotage and open-anchorage transfers."
              : "expect suspended transfers and slower berth cycles."}
            {" "}Persistence {wx.weather_persistence.toFixed(2)} suggests conditions are{" "}
            {Math.abs(wx.weather_impact_score - wx.weather_persistence) < 0.08 ? "stable" : "changing"}.
          </div>
        </Panel>
        <Panel title="Operational meaning">
          <div className="ops-note">
            <b>Pilotage:</b> increase buffer if wind exceeds 25 kt or visibility falls below 5 km.<br />
            <b>Yard planning:</b> hold slack for rain-driven dwell and gate disruption.<br />
            <b>Forecast role:</b> weather shock and persistence raise congestion probability before the TFT horizon is rendered.
          </div>
        </Panel>
        </div>
      </div>
    </>
  );
}
