export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export type SendPush = (messages: PushMessage[]) => Promise<void>;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

/** Fire-and-log Expo push sender. Receipt polling is a post-MVP concern. */
export function createExpoPushSender(fetchImpl: typeof fetch = fetch, log: (msg: string) => void = console.log): SendPush {
  return async (messages) => {
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        log(`expo push: HTTP ${res.status} for batch of ${batch.length}`);
        continue;
      }
      const body = (await res.json()) as { data?: Array<{ status: string; message?: string }> };
      const errors = body.data?.filter((t) => t.status !== "ok") ?? [];
      if (errors.length > 0) log(`expo push: ${errors.length} ticket error(s): ${errors[0]?.message ?? "unknown"}`);
    }
  };
}
