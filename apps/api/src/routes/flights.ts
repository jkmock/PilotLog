import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

import { CreateFlightSchema, UpdateFlightSchema, IdParamsSchema } from "@pilot-log/shared";

import { getCurrentUserId } from "../auth.js";

// Shared column list for the flights table. Legs are loaded separately.
const FLIGHT_COLUMNS = `
  flight_id                 AS id,
  aircraft_id               AS "aircraftId",
  instructor_id             AS "instructorId",
  flight_date               AS "flightDate",
  departure_time            AS "departureTime",
  arrival_time              AS "arrivalTime",
  total_time                AS "totalTime",
  dual_received_time        AS "dualReceivedTime",
  solo_time                 AS "soloTime",
  pic_time                  AS "picTime",
  cross_country_time        AS "crossCountryTime",
  night_time                AS "nightTime",
  actual_instrument_time    AS "actualInstrumentTime",
  simulated_instrument_time AS "simulatedInstrumentTime",
  day_landings_fs           AS "dayLandingsFs",
  day_landings_tg           AS "dayLandingsTg",
  night_landings_fs         AS "nightLandingsFs",
  night_landings_tg         AS "nightLandingsTg",
  instrument_approaches     AS "instrumentApproaches",
  notes,
  created_at                AS "createdAt",
  updated_at                AS "updatedAt"
`;

export default async function flightRoutes(app: FastifyInstance) {
  app.get("/flights/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE flight_id = $1 AND user_id = $2`,
      [params.data.id, getCurrentUserId()],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Flight not found" });
    }

    return result.rows[0];
  });

  app.get("/flights", async (request, reply) => {
  
    const result = await pool.query(
      `SELECT ${FLIGHT_COLUMNS}
      FROM flights WHERE user_id = $1
      ORDER BY flight_date DESC, created_at DESC
      LIMIT 50`,
      [getCurrentUserId()]);

    return result.rows;
  });

  app.post("/flights", async (request, reply) => {
    // 1. Validate
    const parsed = CreateFlightSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: parsed.error.issues });
    }
    const body = parsed.data;
    const userId = getCurrentUserId();

    // 2. Look up all airports in one query
    const idents = [...new Set(body.legs.flatMap((leg) => [leg.origin, leg.destination]))];
    const airportResult = await pool.query(
      `SELECT airport_ident, airport_id FROM airports WHERE airport_ident = ANY($1)`,
      [idents],
    );
    const airportIds = new Map<string, string>(
      airportResult.rows.map((row) => [row.airport_ident, row.airport_id]),
    );
    const unknown = idents.filter((ident) => !airportIds.has(ident));
    if (unknown.length > 0) {
      return reply.code(400).send({ error: `Unknown airport(s): ${unknown.join(", ")}` });
    }

    // 3. The instructor (if any) must be in this user's list
    if (body.instructorId) {
      const instructor = await pool.query(
        `SELECT 1 FROM instructors WHERE instructor_id = $1 AND student_id = $2`,
        [body.instructorId, userId],
      );
      if (instructor.rowCount === 0) {
        return reply.code(400).send({ error: "Instructor not found" });
      }
    }

    // 4. Insert the flight and its legs in one transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const flightResult = await client.query(
        `INSERT INTO flights (
          user_id, instructor_id, aircraft_id, flight_date, departure_time, arrival_time,
          total_time, dual_received_time, solo_time, pic_time, cross_country_time, night_time,
          actual_instrument_time, simulated_instrument_time,
          day_landings_fs, day_landings_tg, night_landings_fs, night_landings_tg,
          instrument_approaches, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING ${FLIGHT_COLUMNS}`,
        [
          userId,
          body.instructorId ?? null,
          body.aircraftId,
          body.flightDate,
          body.departureTime ?? null,
          body.arrivalTime ?? null,
          body.totalTime,
          body.dualReceivedTime ?? 0,
          body.soloTime ?? 0,
          body.picTime ?? 0,
          body.crossCountryTime ?? 0,
          body.nightTime ?? 0,
          body.actualInstrumentTime ?? 0,
          body.simulatedInstrumentTime ?? 0,
          body.dayLandingsFs ?? 0,
          body.dayLandingsTg ?? 0,
          body.nightLandingsFs ?? 0,
          body.nightLandingsTg ?? 0,
          body.instrumentApproaches ?? 0,
          body.notes ?? null,
        ],
      );
      const flight = flightResult.rows[0];

      for (const [index, leg] of body.legs.entries()) {
        await client.query(
          `INSERT INTO flight_legs (flight_id, leg_order, origin_id, destination_id)
          VALUES ($1, $2, $3, $4)`,
          [flight.id, index + 1, airportIds.get(leg.origin), airportIds.get(leg.destination)],
        );
      }

      await client.query("COMMIT");

      return reply.code(201).send({
        ...flight,
        legs: body.legs.map((leg, index) => ({ order: index + 1, ...leg })),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if ((err as { code?: string }).code === "23503") {
        return reply.code(400).send({ error: "Aircraft not found" });
      }
      throw err;
    } finally {
      client.release();
    }
  });

}