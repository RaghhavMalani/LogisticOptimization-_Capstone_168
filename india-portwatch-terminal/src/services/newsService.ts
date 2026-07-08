import { alertEvents, entitySentiment, newsEvents } from "@/data/news";
import type { NewsEvent } from "@/types/portwatch";

export function listNewsEvents(): NewsEvent[] {
  return newsEvents;
}

export function listNewsEventsForEntity(entity: string): NewsEvent[] {
  const normalized = entity.trim().toUpperCase();
  return newsEvents.filter((event) => event.entity.includes(normalized) || event.tag.includes(normalized));
}

export function listAlertEvents() {
  return alertEvents;
}

export function listEntitySentiment() {
  return entitySentiment;
}
