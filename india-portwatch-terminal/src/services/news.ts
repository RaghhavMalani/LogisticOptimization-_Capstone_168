import { getJson } from "./api";
import {
  listAlertEvents,
  listEntitySentiment,
  listNewsEvents,
} from "./newsService";
import type { NewsEvent } from "@/types/portwatch";

interface NewsBundle {
  events: NewsEvent[];
  alerts: ReturnType<typeof listAlertEvents>;
  sentiment: ReturnType<typeof listEntitySentiment>;
}

export async function fetchNewsBundle(): Promise<NewsBundle> {
  return getJson<NewsBundle>("/news", () => ({
    events: listNewsEvents(),
    alerts: listAlertEvents(),
    sentiment: listEntitySentiment(),
  }));
}

export async function fetchNewsEvents(): Promise<NewsEvent[]> {
  return (await fetchNewsBundle()).events;
}

export async function fetchAlertEvents(): Promise<
  ReturnType<typeof listAlertEvents>
> {
  return (await fetchNewsBundle()).alerts;
}

export async function fetchNewsEventsForEntity(
  entity: string,
): Promise<NewsEvent[]> {
  const bundle = await getJson<{ events: NewsEvent[] }>(
    `/news/entity/${encodeURIComponent(entity)}`,
    () => ({
      events: listNewsEvents().filter(
        (event) =>
          event.entity.includes(entity.toUpperCase()) ||
          event.tag.includes(entity.toUpperCase()),
      ),
    }),
  );
  return bundle.events.length ? bundle.events : listNewsEvents();
}
