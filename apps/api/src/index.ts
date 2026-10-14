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

app.get<{ Params: { ident: string } }>("/airports/:ident", async (request, reply) => {
  const ident = request.params.ident.toUpperCase();
  const result = await pool.query(
    `SELECT airport_ident AS ident,
            airport_name  AS name,
            airport_type  AS type,
            ST_Y(airport_location::geometry) AS latitude,
            ST_X(airport_location::geometry) AS longitude
     FROM airports
     WHERE airport_ident = $1`,
    [ident],
  );

  if (result.rows.length === 0) {
    return reply.code(404).send({ error: "Airport not found" });
  }

  return result.rows[0];
})

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