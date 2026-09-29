/**
 * Live event stream.
 *
 * One EventSource is shared by the whole console. The backend publishes
 * `alert.created` and `prediction.completed` over a single SSE connection, and
 * a connection per component would multiply server-side listeners for the same
 * queue. The connection is reference-counted: it opens on the first subscriber
 * and closes when the last one goes away, so navigating away from a page
 * actually releases it.
 *
 * EventSource cannot carry an Authorization header and the stream endpoint does
 * not require one, so the token is not involved here.
 */

import { useEffect, useState } from "react";
import { API_BASE_URL } from "./client";

export type StreamStatus = "idle" | "connecting" | "live" | "reconnecting";

export interface StreamEvent {
  event: string;
  data: unknown;
}

type EventListener = (event: StreamEvent) => void;
type StatusListener = (status: StreamStatus) => void;

let source: EventSource | null = null;
let status: StreamStatus = "idle";
let subscriberCount = 0;

const eventListeners = new Set<EventListener>();
const statusListeners = new Set<StatusListener>();

function setStatus(next: StreamStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of statusListeners) listener(status);
}

function publish(event: string, raw: string): void {
  let data: unknown = raw;
  try {
    data = JSON.parse(raw);
  } catch {
    // Heartbeats arrive as comments and never reach here; anything else that
    // is not JSON is surfaced as the raw string rather than dropped.
  }
  for (const listener of eventListeners) listener({ event, data });
}

function open(): void {
  if (source) return;

  setStatus("connecting");
  const next = new EventSource(`${API_BASE_URL}/events/stream`);

  next.onopen = () => setStatus("live");

  next.onerror = () => {
    // EventSource reconnects on its own; this only reports the gap so the UI
    // can stop claiming to be live. If it closed outright there is nothing
    // reconnecting and the next subscriber starts a fresh attempt.
    setStatus("reconnecting");
  };

  for (const name of ["alert.created", "prediction.completed"]) {
    next.addEventListener(name, (message) => {
      setStatus("live");
      publish(name, (message as MessageEvent<string>).data);
    });
  }

  source = next;
}

function close(): void {
  if (!source) return;
  source.close();
  source = null;
  setStatus("idle");
}

export function getStreamStatus(): StreamStatus {
  return status;
}

/** Subscribes to live events. The returned function releases the connection. */
export function subscribeToStream(listener: EventListener): () => void {
  eventListeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) open();

  return () => {
    eventListeners.delete(listener);
    subscriberCount -= 1;
    if (subscriberCount <= 0) {
      subscriberCount = 0;
      close();
    }
  };
}

function subscribeToStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** Live status for the nav pill and the status strip. */
export function useStreamStatus(): StreamStatus {
  const [current, setCurrent] = useState<StreamStatus>(status);
  useEffect(() => subscribeToStatus(setCurrent), []);
  return current;
}

/** Subscribes to live events for the lifetime of a component. */
export function useStreamEvents(listener: EventListener): void {
  useEffect(() => subscribeToStream(listener), [listener]);
}
