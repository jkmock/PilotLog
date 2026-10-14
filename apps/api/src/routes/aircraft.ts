import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

type CreateAircraftBody = {
  tailNumber: string;
  make: string;
  model: string;
  year?: number;
  aircraftClass: "single_engine_land" | "multi_engine_land";
  isTailwheel?: boolean;
  isComplex?: boolean;
  isHighPerf?: boolean;
};

type UpdateAircraftBody = Partial<Omit<CreateAircraftBody, "tailNumber">>;

// Shared column list: every aircraft endpoint returns this exact shape
const AIRCRAFT_COLUMNS = `
  aircraft_id       AS id,
  tail_number       AS "tailNumber",
  aircraft_make     AS make,
  aircraft_model    AS model,
  aircraft_year     AS year,
  aircraft_category AS category,
  aircraft_class    AS "aircraftClass",
  is_tailwheel      AS "isTailwheel",
  is_complex        AS "isComplex",
  is_high_perf      AS "isHighPerf"
`;

export default async function aircraftRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/aircraft/:id", async (request, reply) => {
    const id = request.params.id;
    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS} FROM aircraft WHERE aircraft_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }

    return result.rows[0];
  });

  app.get<{ Querystring: { tail?: string } }>("/aircraft", async (request, reply) => {
    const tail = request.query.tail?.trim().toUpperCase();

    if (!tail) {
      return reply.code(400).send({ error: "Query parameter 'tail' is required" });
    }

    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS}
      FROM aircraft
      WHERE tail_number LIKE $1 || '%'
      ORDER BY tail_number
      LIMIT 10`,
      [tail],
    );

    return result.rows;
  });

  app.post<{ Body: CreateAircraftBody }>("/aircraft", async (request, reply) => {
    const body = request.body; // NOTE: not validated yet. Zod comes next

    try {
      const result = await pool.query(
        `INSERT INTO aircraft (tail_number, aircraft_make, aircraft_model, aircraft_year,
                               aircraft_category, aircraft_class,
                               is_tailwheel, is_complex, is_high_perf)
         VALUES ($1, $2, $3, $4, 'airplane', $5, $6, $7, $8)
         RETURNING ${AIRCRAFT_COLUMNS}`,
        [
          body.tailNumber.toUpperCase(),
          body.make,
          body.model,
          body.year ?? null,
          body.aircraftClass,
          body.isTailwheel ?? false,
          body.isComplex ?? false,
          body.isHighPerf ?? false,
        ],
      );
      return reply.code(201).send(result.rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "Aircraft with this tail number already exists" });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string }; Body: UpdateAircraftBody }>("/aircraft/:id", async (request, reply) => {
    const body = request.body; // not validated yet. Zod comes next

    const result = await pool.query(
      `UPDATE aircraft
      SET aircraft_make  = COALESCE($2, aircraft_make),
          aircraft_model = COALESCE($3, aircraft_model),
          aircraft_year  = COALESCE($4, aircraft_year),
          aircraft_class = COALESCE($5, aircraft_class),
          is_tailwheel   = COALESCE($6, is_tailwheel),
          is_complex     = COALESCE($7, is_complex),
          is_high_perf   = COALESCE($8, is_high_perf)
      WHERE aircraft_id = $1
      RETURNING ${AIRCRAFT_COLUMNS}`,
      [
        request.params.id,
        body.make ?? null,
        body.model ?? null,
        body.year ?? null,
        body.aircraftClass ?? null,
        body.isTailwheel ?? null,
        body.isComplex ?? null,
        body.isHighPerf ?? null,
      ],
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }
    return result.rows[0];
  });

  app.delete<{ Params: { id: string } }>("/aircraft/:id", async (request, reply) => {
  
    const id = request.params.id;
    
    try {
      const result = await pool.query(
        `DELETE FROM aircraft WHERE aircraft_id = $1`, [id],
      );
      if (result.rowCount === 0) {
        return reply.code(404).send({ error: "Aircraft not found" });
      }
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        return reply.code(409).send({ error: "Aircraft has logged flights." });
      }
      throw err;
    }
    return reply.code(204).send();
  });
}
