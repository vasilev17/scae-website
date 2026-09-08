/// <reference types="astro/client" />

declare module '*.glb' {
  const src: string;
  export default src;
}

declare module '*.html?raw' {
  const src: string;
  export default src;
}

declare module '*.woff2?url' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_FORMSPREE_CONTACT_ID?: string;
  readonly PUBLIC_FORMSPREE_APPLICATION_ID?: string;
  readonly PUBLIC_HCAPTCHA_SITEKEY?: string;
  readonly PUBLIC_POSTHOG_KEY?: string;
  readonly PUBLIC_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
