/* Port Operations Cockpit — single-port control room. */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api, Briefing, Envelope, NewsEvent, Pin, Port, PortForecast, PortIntel,
  PortLive, RegimeTimeline, SarReport, WxReport, fmt,
} from "../api";
import {
  AiBriefing, Badge, DriverCards, ExpertCards, KV, Metric, Panel,
  RegimeProbs, RiskTiles,
} from "../ui";
import { PortOpsVisual } from "../visuals";

export default function Cockpit({ setMode }: { setMode: (m: string) => void }) {
  const { portId = "JNPT" } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState<{
    ports: Port[]; pin: Pin; fc?: PortForecast; reg?: RegimeTimeline;
    brief?: Briefing; intel?: PortIntel; live?: PortLive; news: NewsEvent[];
    wx?: WxReport; sar?: SarReport;
  } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setD(null); setErr("");
    const id = portId.toUpperCase();
    const safe = <T,>(p: Promise<Envelope<T>>) => p.then((x) => x.data).catch(() => undefined);
    Promise.all([
      api.ports(), api.pin(id), safe(api.forecast(id)), safe(api.regime(id)),
      safe(api.briefing(id)), safe(api.drivers(id)), safe(api.live(id)),
      api.newsPort(id).then((x) => x.data).catch(() => []),
      safe(api.wx(id)), safe(api.sar(id)),
    ]).then(([ports, pin, fc, reg, brief, intel, live, news, wx, sar]) => {
      setMode(pin.data_mode);
      setD({ ports: ports.data, pin: pin.data, fc, reg, brief, intel, live, news, wx, sar });
    }).catch((e) => setErr(String(e)));
  }, [portId]);

  if (err) return <div className="panel mono" style={{ color: "var(--red)" }}>{err}</div>;
  if (!d) return <div className="loading">LOADING {portId.toUpperCase()} COCKPIT…</div>;
  const { pin, fc, reg, brief, intel, live, news, wx, sar } = d;
  const cur = reg?.current;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">PORT OPERATIONS COCKPIT — {pin.region.toUpperCase()} COAST</div>
          <h1>{pin.name} <Badge level={pin.regime} /></h1>
          <div className="sub">
            {fc && <>forecast origin {fc.origin_date} · model {fc.model} · </>}
            state confidence {pin.regime_confidence}
          </div>
        </div>
        <select value={pin.port_id} onChange={(e) => nav(`/ports/${e.target.value}`)}>
          {d.ports.map((p) => <option key={p.port_id} value={p.port_id}>{p.name}</option>)}
        </select>
      </div>

      <div className="terminal-band" style={{ marginBottom: 12 }}>
        <span className="label">COMMAND</span><strong>PORT {pin.port_id}</strong>
        <span className="label">CURRENT REGIME</span><strong>{pin.regime}</strong>
        <span className="label">HSMM CONF</span><strong>{cur?.confidence ?? pin.regime_confidence}</strong>
        <span className="label">TFT ORIGIN</span><strong>{fc?.origin_date ?? "WAIT"}</strong>
      </div>

      <div className="kpi-strip">
        <Metric i={0} label="REGIME" value={<Badge level={pin.regime} />} />
        <Metric i={1} label="CONGESTION (D+1)" value={fmt.n1(pin.congestion_now)}
          tone={pin.congestion_now >= 60 ? "red" : pin.congestion_now >= 45 ? "amber" : ""} />
        <Metric i={2} label="PEAK DELAY (H)" value={fmt.n1(brief?.peak_delay_hours)}
          tone={(brief?.peak_delay_hours ?? 0) >= 18 ? "red" : (brief?.peak_delay_hours ?? 0) >= 10 ? "amber" : ""} />
        <Metric i={3} label="THROUGHPUT (T/D)" value={fmt.n0(pin.throughput)} />
        <Metric i={4} label="TRANSITION RISK" value={fmt.pct(pin.transition_risk)}
          tone={pin.transition_risk >= 0.3 ? "amber" : ""} />
        <Metric i={5} label="CONFIDENCE" value={<Badge level={cur?.confidence ?? pin.regime_confidence} />} />
        <div className="reco-box">
          <div className="k">Recommendation</div>
          {brief?.recommended_action ?? "Maintain standard buffer."}
        </div>
      </div>

      {brief && (
        <div className="mt">
          <AiBriefing text={brief.summary.split("Recommended action:")[0].trim()}
            action={brief.recommended_action} />
        </div>
      )}

      <div className="grid mt cockpit-main-grid">
        <Panel title="Port digital twin — live vessel field" custom={0}>
          <PortOpsVisual pin={pin} live={live} sar={sar} />
          <div className="spark-note">
            Anchorage, queue lanes, berth occupancy and proxy vessel movement are rendered from live/SAR-derived operating signals.
          </div>
          {live && (
            <div className="grid cols-2 mt">
              <div>
                <h3>Berth occupancy (derived)</h3>
                <div className="berth-rows">
                  {Array.from({ length: Math.min(pin.berth_count, 10) }, (_, i) => {
                    const occ = Math.max(0, Math.min(1,
                      live.berth_utilization * (1.25 - i * (0.9 / Math.min(pin.berth_count, 10)))));
                    const col = occ >= 0.9 ? "var(--red)" : occ >= 0.65 ? "var(--amber)" : "var(--mint)";
                    return (
                      <div className="berth-row" key={i}>
                        <span>B{i + 1}</span>
                        <div className="bar"><div style={{ width: `${occ * 100}%`, background: col }} /></div>
                        <span>{(occ * 100).toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="queue-list">
                <h3>Anchorage queues</h3>
                <KV k="Outer anchorage" v={`${Math.ceil(live.queue_count * 0.6)} vessels`} />
                <KV k="Inner roads" v={`${Math.floor(live.queue_count * 0.4)} vessels`} />
                <KV k="Approaching" v={`${live.vessels.filter((v) => v.status === "approaching").length} vessels`} />
                <KV k="At berth" v={`${live.vessels.filter((v) => v.status === "berthed").length} vessels`} />
              </div>
            </div>
          )}
        </Panel>
        <div className="grid cockpit-side-stack">
          <Panel title="HSMM regime intelligence" custom={1}>
            <RegimeProbs cur={cur} />
            <details className="more"><summary>REGIME HISTORY (45 DAYS)</summary>
              <div className="regime-strip mt">
                {reg?.history.map((h) => (
                  <div key={h.date} className={`cell ${h.regime}`} title={`${h.date} — ${h.regime}`} />
                ))}
              </div>
            </details>
          </Panel>
          <Panel title="Weather + SAR module outputs" custom={2}>
            {wx ? (
              <>
                <div className="module-grid">
                  <div><span>Wind</span><b>{fmt.n1(wx.wind_kt)} kt</b><em>{wx.wind_dir}</em></div>
                  <div><span>Rain 24h</span><b>{fmt.n1(wx.rainfall_mm)} mm</b><em>impact {wx.weather_impact_score.toFixed(2)}</em></div>
                  <div><span>Wave</span><b>{fmt.n1(wx.wave_m)} m</b><em>vis {fmt.n1(wx.visibility_km)} km</em></div>
                  <div><span>Storm</span><b>{wx.cyclone_risk}</b><em>conf {wx.weather_confidence.toFixed(2)}</em></div>
                </div>
                <div className="mt" />
                <KV k="weather_hsmm_input" v={wx.weather_hsmm_input.toFixed(2)} />
                <KV k="weather_tft_covariate" v={wx.weather_tft_covariate.toFixed(2)} />
                <KV k="weather_persistence" v={wx.weather_persistence.toFixed(2)} />
                <KV k="weather_shock" v={wx.weather_shock.toFixed(2)} />
              </>
            ) : <div className="muted">No weather report.</div>}
            {sar && (
              <>
                <h3 className="mt">SAR/AIS proxy</h3>
                <KV k="vessel_detections" v={sar.vessel_detections} />
                <KV k="queue_zone_activity" v={`${(sar.queue_zone_activity * 100).toFixed(0)}%`} />
                <KV k="change_vs_prev_scene" v={`${sar.change_vs_prev_pct > 0 ? "+" : ""}${fmt.n1(sar.change_vs_prev_pct)}%`} />
              </>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="10-day forecast timeline" className="mt" custom={0}>
        <RiskTiles horizon={fc?.horizon} />
      </Panel>

      <div className="intel-strip mt">
        <div className="intel-cell">
          <div className="k">Weather Expert</div>
          <div className="v">{wx ? wx.weather_impact_score.toFixed(2) : "--"}</div>
          <div className="d">impact score, HSMM input {wx ? wx.weather_hsmm_input.toFixed(2) : "--"}</div>
        </div>
        <div className="intel-cell">
          <div className="k">SAR/AIS Proxy Expert</div>
          <div className="v">{sar ? sar.vessel_detections : live?.vessels.length ?? "--"}</div>
          <div className="d">detections, queue activity {sar ? `${(sar.queue_zone_activity * 100).toFixed(0)}%` : "--"}</div>
        </div>
        <div className="intel-cell">
          <div className="k">News/NLP Expert</div>
          <div className="v">{news.length}</div>
          <div className="d">events mapped to this port</div>
        </div>
        <div className="intel-cell">
          <div className="k">Decision Layer</div>
          <div className="v">{brief ? `D+${brief.peak_congestion_day}` : "--"}</div>
          <div className="d">peak congestion day and recommended action below</div>
        </div>
      </div>

      <div className="grid cols-3 mt">
        <Panel title="Why — forecast drivers" custom={0}>
          <DriverCards drivers={intel?.drivers} />
        </Panel>
        <Panel title="Model outputs — expert chain" custom={1}>
          <ExpertCards experts={intel?.expert_outputs} />
          {fc && brief && (
            <div className="expert-card">
              <div>
                <div className="name">TFT Forecast</div>
                <div className="sig">Peak Day +{brief.peak_congestion_day} / q90 {fmt.n0(brief.peak_congestion_q90)}</div>
                <div className="muted small">Multi-horizon quantile forecast.</div>
              </div>
              <div className="conf">model<br /><b>{fc.model}</b></div>
            </div>
          )}
        </Panel>
        <Panel title="Weather intelligence" custom={2}>
          {wx ? (
            <>
              <div className="wx-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="datum"><div className="k">Wind</div>
                  <div className="v">{fmt.n1(wx.wind_kt)}</div><div className="u">kt {wx.wind_dir}</div></div>
                <div className="datum"><div className="k">Rain 24h</div>
                  <div className="v">{fmt.n1(wx.rainfall_mm)}</div><div className="u">mm</div></div>
                <div className="datum"><div className="k">Wave</div>
                  <div className="v">{fmt.n1(wx.wave_m)}</div><div className="u">m</div></div>
                <div className="datum"><div className="k">Visibility</div>
                  <div className="v">{fmt.n1(wx.visibility_km)}</div><div className="u">km</div></div>
              </div>
              <div className="mt" />
              <KV k="weather_impact_score" v={wx.weather_impact_score.toFixed(2)} />
              <KV k="weather_persistence" v={wx.weather_persistence.toFixed(2)} />
              <KV k="weather_shock" v={wx.weather_shock.toFixed(2)} />
              <KV k="weather_hsmm_input" v={wx.weather_hsmm_input.toFixed(2)} />
              <KV k="weather_tft_covariate" v={wx.weather_tft_covariate.toFixed(2)} />
              <div className="spark-note">Weather Expert feeds HSMM regime and TFT forecast.</div>
              {sar && <>
                <h3 className="mt">SAR/AIS proxy</h3>
                <KV k="vessel_detections" v={sar.vessel_detections} />
                <KV k="anchorage_density" v={fmt.n1(sar.anchorage_density)} />
                <KV k="queue_zone_activity" v={`${(sar.queue_zone_activity * 100).toFixed(0)}%`} />
                <KV k="change_vs_prev_scene" v={`${sar.change_vs_prev_pct > 0 ? "+" : ""}${fmt.n1(sar.change_vs_prev_pct)}%`} />
              </>}
            </>
          ) : <div className="muted">No weather report.</div>}
          <h3 className="mt">News intelligence — this port</h3>
          {news.length ? news.slice(0, 4).map((n, i) => (
            <div className="news-card" key={i}>
              <div className="h">{n.headline}</div>
              <div className="meta">
                <Badge level={n.risk_score >= 0.6 ? "HIGH" : n.risk_score >= 0.35 ? "MEDIUM" : "LOW"} />
                <span className="chip">{n.entity}</span>
                <span className="chip">{n.event_type}</span>
                <span className="chip">risk {n.risk_score.toFixed(2)}</span>
              </div>
              <div className="impact">{n.model_impact}</div>
            </div>
          )) : <div className="muted">No events currently mapped to this port.</div>}
        </Panel>
      </div>
    </>
  );
}
