import Fastify from "fastify";
import { pool } from "./db.js";

const app = Fastify({ logger: true });

app.get("/health", async (_request, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ok" };
  } catch (err) {
    app.log.error(err);
    return reply.code(503).send({ status: "unavailable" });
  }
});

// graceful shutdown on SIGINT (close the app, then pool.end())
async function shutdown(signal: string) {
  app.log.info(`${signal} received, shutting down`);
  await app.close(); // stop accepting requests, finish in-flight ones
  await pool.end();  // close all database connections
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));   // Ctrl+C
process.on("SIGTERM", () => void shutdown("SIGTERM")); // sent by hosting platforms and tsx watch restarts

await app.listen({ port: 3000 });