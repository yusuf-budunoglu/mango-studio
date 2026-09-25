let counter = 0

/** Kısa, çakışmayan id üretir: `b-lz3k9x-1a` gibi. */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`
