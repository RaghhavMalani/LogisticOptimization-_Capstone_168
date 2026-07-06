/* India-focused ATC map. MapLibre GL + dark raster basemap when available;
   graceful SVG vector fallback when offline. */

const INDIA_CENTER = [79.5, 17.5];
const INDIA_BOUNDS = [[63.0, 4.0], [97.5, 30.5]];

function markerSize(congestion) {
  // 10..30 px by congestion index
  const c = Math.max(0, Math.min(100, congestion || 0));
  return 10 + (c / 100) * 20;
}

function popupHtml(pin) {
  return `<div style="font-size:12px;min-width:180px">
    <b>${esc(pin.name)}</b> ${RegimeBadge(pin.regime)}<br/>
    <span class="muted">congestion</span> <span class="mono">${fmt.n1(pin.congestion_now)}</span> ·
    <span class="muted">delay</span> <span class="mono">${fmt.n1(pin.delay_hours)}h</span><br/>
    <a href="/ports/${esc(pin.port_id)}" data-link>Open cockpit →</a>
  </div>`;
}

function renderPortMap(el, pins, { onSelect } = {}) {
  if (window.maplibregl && !window.__noMap) {
    return renderMapLibre(el, pins, onSelect);
  }
  return renderSvgFallback(el, pins, onSelect);
}

function renderMapLibre(el, pins, onSelect) {
  const map = new maplibregl.Map({
    container: el,
    style: {
      version: 8,
      sources: {
        dark: {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          ],
          tileSize: 256,
          attribution: "© OpenStreetMap © CARTO",
        },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#0b1120" } },
        { id: "dark", type: "raster", source: "dark",
          paint: { "raster-opacity": 0.9, "raster-saturation": -0.4 } },
      ],
    },
    center: INDIA_CENTER,
    zoom: 4.2,
    maxBounds: [[55, -2], [105, 38]],
    attributionControl: false,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  map.fitBounds(INDIA_BOUNDS, { padding: 30, duration: 0 });

  for (const pin of pins) {
    const d = document.createElement("div");
    const size = markerSize(pin.congestion_now);
    d.className = `port-marker ${pin.regime}`;
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;
    d.title = `${pin.name} — ${pin.regime}`;
    d.addEventListener("click", (e) => {
      e.stopPropagation();
      onSelect ? onSelect(pin) : navigate(`/ports/${pin.port_id}`);
    });
    const popup = new maplibregl.Popup({ offset: 14, closeButton: false })
      .setHTML(popupHtml(pin));
    new maplibregl.Marker({ element: d })
      .setLngLat([pin.lon, pin.lat])
      .setPopup(popup)
      .addTo(map);
    d.addEventListener("mouseenter", () => popup.addTo(map).setLngLat([pin.lon, pin.lat]));
    d.addEventListener("mouseleave", () => popup.remove());
  }
  return map;
}

/* Offline fallback: linear lon/lat projection with labelled pins. */
function renderSvgFallback(el, pins, onSelect) {
  const [minLon, minLat] = [66, 5], [maxLon, maxLat] = [96, 32];
  const W = 900, H = 760;
  const X = (lon) => ((lon - minLon) / (maxLon - minLon)) * W;
  const Y = (lat) => (1 - (lat - minLat) / (maxLat - minLat)) * H;
  const color = { NORMAL: "var(--green)", CONGESTED: "var(--amber)", SEVERE: "var(--red)" };

  const dots = pins
    .map((p) => {
      const r = markerSize(p.congestion_now) / 2.2;
      return `<g class="pin" data-port="${esc(p.port_id)}">
        <circle cx="${X(p.lon).toFixed(0)}" cy="${Y(p.lat).toFixed(0)}" r="${r.toFixed(1)}"
          fill="${color[p.regime] || "var(--green)"}" opacity=".9" stroke="rgba(255,255,255,.6)"/>
        <text x="${(X(p.lon) + r + 4).toFixed(0)}" y="${(Y(p.lat) + 3).toFixed(0)}">${esc(p.port_id)}</text>
      </g>`;
    })
    .join("");

  el.innerHTML = `<svg class="svgmap" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#0b1120"/>
    <text x="16" y="26" style="letter-spacing:3px">INDIA — VECTOR FALLBACK (map tiles unavailable)</text>
    ${dots}
  </svg>`;
  el.querySelectorAll(".pin").forEach((g) =>
    g.addEventListener("click", () => {
      const id = g.getAttribute("data-port");
      const pin = pins.find((p) => p.port_id === id);
      onSelect ? onSelect(pin) : navigate(`/ports/${id}`);
    })
  );
  return null;
}

function MapLegend() {
  return `<div class="map-legend">
    <span><span class="legend-dot" style="background:var(--green)"></span>Normal</span>
    <span><span class="legend-dot" style="background:var(--amber)"></span>Congested</span>
    <span><span class="legend-dot" style="background:var(--red)"></span>Severe</span>
    <span class="muted">size = congestion</span>
  </div>`;
}
