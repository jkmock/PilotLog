import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

export default async function airportRoutes(app: FastifyInstance) {

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
  });

}