import { chokepointRoutes, chokepoints, ports, portRisks } from "@/data/ports";
import type {
  Chokepoint,
  ChokepointRoute,
  Port,
  PortRisk,
} from "@/types/portwatch";

export interface PortOperationalSnapshot extends Port, PortRisk {}

export function listPorts(): Port[] {
  return ports;
}

export function listPortRisks(): PortRisk[] {
  return portRisks;
}

export function listPortOperationalSnapshots(): PortOperationalSnapshot[] {
  return ports.map((port) => {
    const risk = getPortRisk(port.code);
    return { ...port, ...risk };
  });
}

export function getPortRisk(portCode: string): PortRisk {
  return portRisks.find((risk) => risk.portCode === portCode) ?? portRisks[0];
}

export function getPort(portCodeOrName: string): Port {
  const normalized = portCodeOrName.trim().toUpperCase();
  return (
    ports.find(
      (port) => port.code === normalized || port.short === normalized,
    ) ??
    ports.find((port) => port.name.toUpperCase().includes(normalized)) ??
    ports[0]
  );
}

export function getPortSnapshot(
  portCodeOrName: string,
): PortOperationalSnapshot {
  const port = getPort(portCodeOrName);
  return { ...port, ...getPortRisk(port.code) };
}

export function listChokepoints(): Chokepoint[] {
  return chokepoints;
}

export function listChokepointRoutes(): ChokepointRoute[] {
  return chokepointRoutes;
}

export function getNationalStressScore(): number {
  const meanCongestion =
    portRisks.reduce((sum, risk) => sum + risk.congestion, 0) /
    Math.max(1, portRisks.length);
  const severeLoad =
    portRisks.filter((risk) => risk.risk === "severe").length /
    Math.max(1, portRisks.length);
  return Math.round(meanCongestion * 70 + severeLoad * 30);
}
