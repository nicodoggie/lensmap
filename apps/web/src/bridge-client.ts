import type { DocumentSnapshot } from "@lensmap/document";

export type BridgeEvent =
  | { type: "session"; documents: DocumentSnapshot[]; activeUri: string | null }
  | { type: "snapshot"; snapshot: DocumentSnapshot }
  | {
      type: "caret";
      uri: string;
      key: string | null;
      revision: number;
      sequence: number;
    }
  | { type: "focus"; uri: string; key: string; sequence: number };

/** A private URL bootstraps an HttpOnly cookie; its fragment is removed at once. */
export function connectBridge(
  onEvent: (event: BridgeEvent) => void,
  onStatus: (connected: boolean, error?: string) => void,
): () => void {
  let disposed = false;
  let events: EventSource | undefined;
  const token = new URLSearchParams(location.hash.slice(1)).get("token");
  if (location.hash)
    history.replaceState(null, "", location.pathname + location.search);
  const controller = new AbortController();
  const start = async () => {
    if (token) {
      const response = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "Preview authorization failed. Reopen the preview from Zed.",
        );
    }
    if (disposed) return;
    events = new EventSource("/api/events");
    events.onopen = () => onStatus(true);
    events.onerror = () =>
      onStatus(
        false,
        "Disconnected or unauthorized. Reopen the preview from Zed after a server restart.",
      );
    events.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as BridgeEvent);
      } catch {
        onStatus(false, "The bridge sent an invalid update.");
      }
    };
  };
  void start().catch((error: unknown) => {
    if (!disposed)
      onStatus(
        false,
        error instanceof Error ? error.message : "Preview connection failed.",
      );
  });
  return () => {
    disposed = true;
    controller.abort();
    events?.close();
  };
}

export async function revealSource(uri: string, key: string): Promise<void> {
  const response = await fetch("/api/reveal", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uri, key }),
  });
  if (!response.ok) {
    const result: { error?: string } = await response.json();
    throw new Error(result.error ?? "Source reveal failed.");
  }
}
