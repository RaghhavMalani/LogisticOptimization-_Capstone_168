import { useEffect } from "react";
import maplibregl, { MapLayerMouseEvent } from "maplibre-gl";

function html(props: Record<string, unknown>) {
  const regime = String(props.regime ?? "UNKNOWN");
  const name = String(props.name ?? props.id ?? "Port");
  const id = String(props.id ?? "");
  const congestion = Number(props.congestion ?? 0).toFixed(1);
  const delay = Number(props.delay ?? 0).toFixed(1);
  const transition = (Number(props.transition ?? 0) * 100).toFixed(0);
  const confidence = String(props.confidence ?? "UNKNOWN");
  return `
    <div class="port-tooltip">
      <div class="pt-head">
        <b>${id}</b>
        <span class="${regime.toLowerCase()}">${regime}</span>
      </div>
      <div class="pt-name">${name}</div>
      <div class="pt-grid">
        <span>Congestion</span><b>${congestion}</b>
        <span>Delay</span><b>${delay} h</b>
        <span>Transition</span><b>${transition}%</b>
        <span>Confidence</span><b>${confidence}</b>
      </div>
      <div class="pt-action">Click to open port cockpit</div>
    </div>
  `;
}

export default function PortTooltip({
  map,
  layerId,
  onSelect,
}: {
  map: maplibregl.Map;
  layerId: string;
  onSelect: (portId: string) => void;
}) {
  useEffect(() => {
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "portwatch-map-popup",
    });
    const enter = (event: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = "pointer";
      const feature = event.features?.[0];
      if (!feature) return;
      popup.setLngLat(event.lngLat).setHTML(html(feature.properties ?? {})).addTo(map);
    };
    const move = (event: MapLayerMouseEvent) => {
      if (popup.isOpen()) popup.setLngLat(event.lngLat);
    };
    const leave = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };
    const click = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const id = String(feature?.properties?.id ?? "");
      if (id) onSelect(id);
    };
    map.on("mouseenter", layerId, enter);
    map.on("mousemove", layerId, move);
    map.on("mouseleave", layerId, leave);
    map.on("click", layerId, click);
    return () => {
      popup.remove();
      map.off("mouseenter", layerId, enter);
      map.off("mousemove", layerId, move);
      map.off("mouseleave", layerId, leave);
      map.off("click", layerId, click);
    };
  }, [map, layerId, onSelect]);

  return null;
}
