import { createServer } from "node:http";
import { handleRequest } from "./index.ts";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535");
const server = createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(new URL(incoming.url ?? "/", `http://127.0.0.1:${port}`), { method: incoming.method ?? "GET" });
    const response = await handleRequest(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(await response.text());
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unexpected request failure");
    outgoing.writeHead(500, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unable to complete request." } }));
  }
});
server.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`AutoMate API: http://127.0.0.1:${port}/health`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close());
