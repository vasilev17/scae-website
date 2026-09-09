import { env } from '@/lib/env';

type EventProps = Record<string, string | number | boolean | null | undefined>;

type PostHogClient = {
  capture: (event: string, props?: EventProps) => void;
  register: (props: EventProps) => void;
};

let booted = false;
let client: PostHogClient | null = null;
const pending: Array<[string, EventProps | undefined]> = [];
let context: EventProps = {};

function flush() {
  if (!client) return;
  client.register(context);
  for (const [event, props] of pending) {
    client.capture(event, props);
  }
  pending.length = 0;
}

export function initAnalytics() {
  if (booted) return;
  booted = true;

  const key = env.PUBLIC_POSTHOG_KEY;
  const host = env.PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;

  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      persistence: 'memory',
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      capture_performance: { web_vitals: true },
    });
    client = posthog;
    flush();
  });
}

export function setAnalyticsContext(props: EventProps) {
  context = { ...context, ...props };
  if (import.meta.env.DEV) console.info('[analytics] context', context);
  client?.register(props);
}

/** Safe before init — events queue until PostHog is up. */
export function track(event: string, props?: EventProps) {
  if (import.meta.env.DEV) console.info('[analytics]', event, props);
  if (!env.PUBLIC_POSTHOG_KEY) return;
  if (client) {
    client.capture(event, props);
    return;
  }
  pending.push([event, props]);
}
