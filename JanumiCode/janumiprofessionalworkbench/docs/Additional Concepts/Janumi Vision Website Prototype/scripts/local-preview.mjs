import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const clientRoot = resolve(projectRoot, "dist", "client");
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("preview", `${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function assetPath(pathname) {
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidate = resolve(clientRoot, decoded);
  if (candidate !== clientRoot && !candidate.startsWith(`${clientRoot}${sep}`)) return null;
  return candidate;
}

async function assetResponse(requestOrUrl) {
  const url = requestOrUrl instanceof Request ? new URL(requestOrUrl.url) : requestOrUrl;
  const path = assetPath(url.pathname);
  if (!path) return new Response("Not found", { status: 404 });
  try {
    const info = await stat(path);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(path);
    return new Response(body, {
      headers: {
        "cache-control": "no-store",
        "content-length": String(body.byteLength),
        "content-type": mimeTypes.get(extname(path).toLowerCase()) ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const server = createServer(async (incoming, outgoing) => {
  try {
    if (incoming.method !== "GET" && incoming.method !== "HEAD") {
      outgoing.writeHead(405, { allow: "GET, HEAD" });
      outgoing.end();
      return;
    }

    const url = new URL(incoming.url ?? "/", `http://${host}:${port}`);
    const directAsset = await assetResponse(url);
    const response = directAsset.status !== 404
      ? directAsset
      : await worker.fetch(
          new Request(url, { headers: incoming.headers, method: incoming.method }),
          { ASSETS: { fetch: assetResponse } },
          { passThroughOnException() {}, waitUntil() {} },
        );

    const headers = Object.fromEntries(response.headers.entries());
    outgoing.writeHead(response.status, headers);
    if (incoming.method === "HEAD") {
      outgoing.end();
      return;
    }
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end("Local preview failed");
  }
});

server.listen(port, host, () => {
  console.log(`Janumi local preview: http://${host}:${port}`);
});

