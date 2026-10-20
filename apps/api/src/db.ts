import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// numeric (type id 1700): return a number instead of a string
pg.types.setTypeParser(1700, (value) => parseFloat(value));

// date (type id 1082): keep the "YYYY-MM-DD" string as-is, with no time zone conversion
pg.types.setTypeParser(1082, (value) => value);

export const pool = new pg.Pool({ connectionString });