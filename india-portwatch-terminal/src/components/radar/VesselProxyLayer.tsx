import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { LayerGroup, Marker, Polyline, Tooltip } from "react-leaflet";
import type {
  VesselKind,
  VesselOperationalStatus,
  VesselProxy,
} from "@/types/portwatch";

interface AISContact {
  id: string;
  position: [number, number];
  heading: number;
  type: VesselKind;
  status: VesselOperationalStatus;
  speed: number;
  confidence: number;
  source: VesselProxy["source"];
  destination: string;
  lane: string;
  named?: VesselProxy;
}

interface Corridor {
  id: string;
  lane: string;
  start: [number, number];
  control: [number, number];
  end: [number, number];
  count: number;
  type: VesselKind;
  status: VesselOperationalStatus;
  destination: string;
  source?: VesselProxy["source"];
  offset: number;
}

const vesselLabels: Record<VesselKind, string> = {
  CONT: "CONTAINER",
  BULK: "BULK CARRIER",
  TANKER: "TANKER",
  LNG: "LNG/GAS",
  GENERAL_CARGO: "GENERAL CARGO",
  PATROL: "PATROL",
  SERVICE: "SERVICE",
  TUG: "TUG",
  OTHER: "UNCLASSIFIED",
};

const corridors: Corridor[] = [
  {
    id: "hormuz-west",
    lane: "HORMUZ - MUNDRA/JNPT",
    start: [24.4, 58.2],
    control: [22.8, 64.8],
    end: [19.1, 72.2],
    count: 12,
    type: "TANKER",
    status: "underway",
    destination: "INBOM",
    offset: 0,
  },
  {
    id: "arabian-container",
    lane: "ARABIAN SEA CONTAINER LANE",
    start: [11.2, 58.6],
    control: [13.4, 67.5],
    end: [18.8, 72.7],
    count: 14,
    type: "CONT",
    status: "underway",
    destination: "INNSA",
    offset: 1,
  },
  {
    id: "west-coast-coastal",
    lane: "WEST COAST COASTAL RUN",
    start: [7.4, 76.0],
    control: [12.4, 72.2],
    end: [21.9, 69.9],
    count: 11,
    type: "GENERAL_CARGO",
    status: "underway",
    destination: "INMUN",
    offset: 2,
  },
  {
    id: "south-rounding",
    lane: "SOUTH INDIA ROUNDING LANE",
    start: [5.2, 73.6],
    control: [6.4, 79.8],
    end: [10.6, 84.6],
    count: 10,
    type: "BULK",
    status: "underway",
    destination: "INMAA",
    offset: 3,
  },
  {
    id: "bay-chennai",
    lane: "CHENNAI APPROACH LANE",
    start: [10.8, 88.8],
    control: [11.8, 84.8],
    end: [13.0, 80.9],
    count: 9,
    type: "CONT",
    status: "approach",
    destination: "INMAA",
    offset: 4,
  },
  {
    id: "bay-east-coast",
    lane: "BAY OF BENGAL EAST COAST",
    start: [8.2, 91.2],
    control: [14.8, 88.0],
    end: [21.4, 87.5],
    count: 13,
    type: "BULK",
    status: "underway",
    destination: "INHAL",
    offset: 5,
  },
  {
    id: "malacca-india",
    lane: "MALACCA - EAST INDIA",
    start: [2.8, 100.2],
    control: [6.4, 94.2],
    end: [12.8, 81.2],
    count: 15,
    type: "CONT",
    status: "underway",
    destination: "INMAA",
    offset: 6,
  },
  {
    id: "red-sea-reroute",
    lane: "RED SEA DISRUPTION REROUTE",
    start: [12.6, 43.8],
    control: [9.4, 55.8],
    end: [8.4, 76.2],
    count: 10,
    type: "TANKER",
    status: "rerouted",
    destination: "INBOM",
    source: "AIS_SAR",
    offset: 7,
  },
  {
    id: "bay-weather-box",
    lane: "BAY WEATHER AVOIDANCE BOX",
    start: [5.6, 84.2],
    control: [9.4, 89.4],
    end: [16.2, 91.0],
    count: 8,
    type: "PATROL",
    status: "restricted",
    destination: "INMAA",
    source: "AIS_SAR",
    offset: 8,
  },
];

function curvePoint(
  start: [number, number],
  control: [number, number],
  end: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
    u * u * start[1] + 2 * u * t * control[1] + t * t * end[1],
  ];
}

function corridorLine(corridor: Corridor, steps = 42) {
  return Array.from({ length: steps + 1 }, (_, index) =>
    curvePoint(corridor.start, corridor.control, corridor.end, index / steps),
  );
}

function headingBetween(from: [number, number], to: [number, number]) {
  const dy = to[0] - from[0];
  const dx = to[1] - from[1];
  return Math.round((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function statusColor(contact: Pick<AISContact, "confidence" | "status">) {
  if (contact.confidence < 0.74) return "#c58cff";
  if (contact.status === "restricted" || contact.status === "rerouted") {
    return "#ff5566";
  }
  if (
    contact.status === "anchored" ||
    contact.status === "waiting" ||
    contact.status === "delayed"
  ) {
    return "#ffb347";
  }
  if (contact.status === "berthed") return "#7ef0b4";
  return "#7dd3fc";
}

function colorForNamed(vessel: VesselProxy) {
  if (vessel.confidence < 0.74 || vessel.riskExposure === "proxy") {
    return "#c58cff";
  }
  if (
    vessel.status === "restricted" ||
    vessel.status === "rerouted" ||
    vessel.riskExposure === "severe"
  ) {
    return "#ff5566";
  }
  if (
    vessel.status === "anchored" ||
    vessel.status === "waiting" ||
    vessel.status === "delayed" ||
    vessel.riskExposure === "high"
  ) {
    return "#ffb347";
  }
  if (vessel.status === "berthed" || vessel.riskExposure === "low") {
    return "#7ef0b4";
  }
  return "#7dd3fc";
}

function toNamedContact(vessel: VesselProxy): AISContact {
  return {
    id: vessel.id,
    position: [vessel.location.lat, vessel.location.lon],
    heading: vessel.heading,
    type: vessel.vesselType,
    status: vessel.status ?? "underway",
    speed: vessel.speedKnots,
    confidence: vessel.confidence,
    source: vessel.source,
    destination: vessel.destinationPortCode ?? "IND",
    lane:
      vessel.approachLane ??
      vessel.anchorageZone ??
      vessel.routeId ??
      vessel.berthId ??
      "AIS OPEN SEA",
    named: vessel,
  };
}

function buildCorridorContacts(): AISContact[] {
  return corridors.flatMap((corridor) =>
    Array.from({ length: corridor.count }, (_, index) => {
      const t = (index + 1) / (corridor.count + 1);
      const wobble = Math.sin((index + 1) * 1.7 + corridor.offset) * 0.16;
      const base = curvePoint(
        corridor.start,
        corridor.control,
        corridor.end,
        t,
      );
      const next = curvePoint(
        corridor.start,
        corridor.control,
        corridor.end,
        Math.min(0.98, t + 0.025),
      );
      const heading = headingBetween(base, next);
      const side = (heading + 90) * (Math.PI / 180);
      const confidence = index % 9 === 0 ? 0.7 : 0.82 + ((index + corridor.offset) % 5) * 0.025;
      return {
        id: `${corridor.id}-${index + 1}`,
        position: [
          base[0] + Math.cos(side) * wobble,
          base[1] + Math.sin(side) * wobble,
        ],
        heading,
        type:
          index % 11 === 0
            ? "LNG"
            : index % 7 === 0
              ? "GENERAL_CARGO"
              : corridor.type,
        status:
          index % 13 === 0
            ? "delayed"
            : index % 17 === 0
              ? "restricted"
              : corridor.status,
        speed: 8 + ((index + corridor.offset) % 9) + (corridor.status === "approach" ? -3 : 0),
        confidence,
        source: confidence < 0.74 ? "SAR" : corridor.source ?? "AIS",
        destination: corridor.destination,
        lane: corridor.lane,
      } satisfies AISContact;
    }),
  );
}

function movedPosition(
  contact: AISContact,
  tick: number,
  index: number,
): [number, number] {
  const heading = (contact.heading * Math.PI) / 180;
  const underway =
    contact.status === "underway" ||
    contact.status === "approach" ||
    contact.status === "rerouted" ||
    contact.status === "restricted";
  const distance = underway ? Math.min(0.08, contact.speed * 0.0025) : 0.006;
  const phase = tick * (underway ? 0.28 : 0.1) + index * 0.42;
  const crossTrack = Math.sin(phase) * (underway ? 0.006 : 0.012);
  return [
    contact.position[0] +
      Math.cos(heading) * distance * Math.sin(phase * 0.45) +
      Math.cos(heading + Math.PI / 2) * crossTrack,
    contact.position[1] +
      Math.sin(heading) * distance * Math.sin(phase * 0.45) +
      Math.sin(heading + Math.PI / 2) * crossTrack,
  ];
}

function statusLabel(status?: VesselOperationalStatus) {
  return (status ?? "underway").replace("_", " ").toUpperCase();
}

function wake(
  position: [number, number],
  heading: number,
  contact: AISContact,
): [number, number][] | null {
  if (
    contact.status === "anchored" ||
    contact.status === "berthed" ||
    contact.status === "waiting" ||
    contact.speed < 2
  ) {
    return null;
  }
  const radians = (heading * Math.PI) / 180;
  const length = contact.named ? Math.min(0.35, 0.06 + contact.speed * 0.012) : 0.18;
  return [
    position,
    [
      position[0] - Math.cos(radians) * length,
      position[1] - Math.sin(radians) * length,
    ],
  ];
}

function vesselIcon(contact: AISContact) {
  const color = contact.named ? colorForNamed(contact.named) : statusColor(contact);
  const sourceClass =
    contact.source === "SAR" ? "sar" : contact.source === "AIS_SAR" ? "fused" : "ais";
  const statusClass = contact.status ?? "underway";
  const trafficClass = contact.named ? "named" : "traffic";
  const size = contact.named ? 24 : 18;
  return L.divIcon({
    className: "pw-radar-vessel-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <span class="pw-radar-vessel ${trafficClass} ${sourceClass} ${statusClass}" style="--vessel-color:${color}; --vessel-heading:${contact.heading}deg">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <path class="hull" d="M18 2.8 C24.4 8.2 26.8 18.3 23.4 29 L18 33.2 L12.6 29 C9.2 18.3 11.6 8.2 18 2.8 Z" />
          <path class="detail" d="M14 13 H22 M14.6 18 H21.4 M15.2 23 H20.8" />
        </svg>
        <i></i>
      </span>
    `,
  });
}

export function VesselProxyLayer({
  vessels,
  visible,
}: {
  vessels: VesselProxy[];
  visible: boolean;
}) {
  const [tick, setTick] = useState(0);
  const contacts = useMemo(
    () => [...buildCorridorContacts(), ...vessels.map(toNamedContact)],
    [vessels],
  );

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1300);
    return () => window.clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <LayerGroup>
      {corridors.map((corridor) => (
        <Polyline
          key={corridor.id}
          positions={corridorLine(corridor)}
          pathOptions={{
            color:
              corridor.status === "rerouted" || corridor.status === "restricted"
                ? "#ff5566"
                : "#1fc7e6",
            opacity: 0.28,
            weight: 0.85,
            dashArray: "3 8",
            className: "pw-ais-corridor-line",
          }}
        />
      ))}
      {contacts.map((contact, index) => {
        const position = movedPosition(contact, tick, index);
        const color = contact.named ? colorForNamed(contact.named) : statusColor(contact);
        const wakeLine = wake(position, contact.heading, contact);
        return (
          <LayerGroup key={contact.id}>
            {wakeLine && (
              <Polyline
                positions={wakeLine}
                pathOptions={{
                  color,
                  opacity: contact.named ? 0.42 : 0.28,
                  weight: contact.named ? 0.9 : 0.55,
                  dashArray: contact.status === "rerouted" ? "5 7" : "2 7",
                  className: "pw-vessel-wake-line",
                }}
              />
            )}
            <Marker position={position} icon={vesselIcon(contact)}>
              {contact.named && (
                <Tooltip
                  className="pw-port-tooltip"
                  direction="top"
                  offset={[0, -12]}
                >
                  <div className="pw-tooltip-card">
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color }}>{vesselLabels[contact.type]}</span>
                      <span>{contact.source}</span>
                    </div>
                    <div>{contact.id}</div>
                    <div className="grid grid-cols-[88px_76px] gap-x-2 tabular-nums">
                      <span>STATUS</span>
                      <b>{statusLabel(contact.status)}</b>
                      <span>SPEED</span>
                      <b>{contact.speed.toFixed(1)} kt</b>
                      <span>HEADING</span>
                      <b>{contact.heading} deg</b>
                      <span>ETA</span>
                      <b>{contact.named.eta ?? "TBD"}</b>
                      <span>DEST</span>
                      <b>{contact.destination}</b>
                      <span>LANE</span>
                      <b>{contact.lane}</b>
                      <span>CONF</span>
                      <b>{Math.round(contact.confidence * 100)}%</b>
                    </div>
                  </div>
                </Tooltip>
              )}
            </Marker>
          </LayerGroup>
        );
      })}
    </LayerGroup>
  );
}
