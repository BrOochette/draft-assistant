/** Pages autorisées à lire la draft : l'appli en développement et le site Cloudflare (`draft-assistant.<sous-domaine>.workers.dev`). */
const DEFAULT_ORIGINS = [/^http:\/\/(localhost|127\.0\.0\.1):(5173|4173)$/, /^https:\/\/draft-assistant\.[a-z0-9-]+\.workers\.dev$/];

/** Origines ajoutées par `DRAFT_BRIDGE_ORIGINS` (séparées par des virgules), par exemple un domaine personnalisé. */
const extra = () => (process.env.DRAFT_BRIDGE_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);

export const isAllowedOrigin = (origin: string | undefined): boolean =>
  !!origin && (DEFAULT_ORIGINS.some((re) => re.test(origin)) || extra().includes(origin));
