export const flags = {
  customCursor: false,
  qualityDebug: false,
} as const satisfies Record<string, boolean>;

export type FlagName = keyof typeof flags;
