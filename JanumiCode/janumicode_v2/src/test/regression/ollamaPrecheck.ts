/**
 * Ollama reachability check. Failure mode is loud: every regression
 * live test depends on Ollama, and skipping silently is how the old
 * fixture suite rotted.
 */

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

export function ollamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? process.env.OLLAMA_URL ?? DEFAULT_BASE_URL;
}

export async function ensureOllamaReachable(): Promise<void> {
  const base = ollamaBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/tags`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(
        `Ollama at ${base} returned HTTP ${res.status} — regression live tests require Ollama running. To run only unit tests: pnpm test:unit.`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Ollama at ${base} is unreachable — regression live tests require Ollama running. To run only unit tests: pnpm test:unit. (${msg})`,
    );
  } finally {
    clearTimeout(timer);
  }
}
