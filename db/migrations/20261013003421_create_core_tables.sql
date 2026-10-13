-- migrate:up

-- Case-insensitive text type, used for users.email
CREATE EXTENSION IF NOT EXISTS citext;

-- Shared trigger function: sets updated_at whenever a row changes.
-- Defined once, attached to every table that has updated_at.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE users (
  user_id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name     text        NOT NULL,
  last_name      text        NOT NULL,
  email          citext      NOT NULL UNIQUE,
  password_hash  text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE instructors (
  instructor_id  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  first_name     text        NOT NULL,
  last_name      text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, first_name, last_name)
);

CREATE TRIGGER instructors_set_updated_at
  BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE airports (
  airport_id       uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_ident    text                   NOT NULL UNIQUE CHECK (airport_ident = upper(airport_ident)),
  airport_type     text                   NOT NULL CHECK (airport_type in ('small_airport', 'medium_airport', 'large_airport', 'closed')),
  airport_name     text                   NOT NULL,
  airport_location geography(Point, 4326) NOT NULL,
  created_at       timestamptz            NOT NULL DEFAULT now(),
  updated_at       timestamptz            NOT NULL DEFAULT now()
);

CREATE TRIGGER airports_set_updated_at
  BEFORE UPDATE ON airports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE aircraft (
  aircraft_id       uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  tail_number       text                   NOT NULL UNIQUE CHECK (tail_number = upper(tail_number)),
  aircraft_make     text                   NOT NULL,
  aircraft_model    text                   NOT NULL,
  aircraft_year     smallint               CHECK (aircraft_year >= 1903),
  aircraft_category text                   NOT NULL CHECK (aircraft_category in ('airplane')),
  aircraft_class    text                   NOT NULL CHECK (aircraft_class in ('single_engine_land', 'multi_engine_land')),
  is_tailwheel      boolean                NOT NULL DEFAULT false,
  is_complex        boolean                NOT NULL DEFAULT false,
  is_high_perf      boolean                NOT NULL DEFAULT false,
  created_at       timestamptz            NOT NULL DEFAULT now(),
  updated_at       timestamptz            NOT NULL DEFAULT now()
);

CREATE TRIGGER aircraft_set_updated_at
  BEFORE UPDATE ON aircraft
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE flights (
  flight_id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid          NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  instructor_id             uuid          REFERENCES instructors (instructor_id),
  flight_date               date          NOT NULL,
  aircraft_id               uuid          NOT NULL REFERENCES aircraft (aircraft_id),
  total_time                numeric(4, 1) NOT NULL CHECK (total_time > 0),
  departure_time            timestamptz	  ,
  arrival_time              timestamptz	  ,
  dual_received_time        numeric(4, 1) NOT NULL DEFAULT 0 CHECK (dual_received_time >= 0 AND dual_received_time <= total_time),
  solo_time                 numeric(4, 1) NOT NULL DEFAULT 0 CHECK (solo_time >= 0 AND solo_time <= total_time),
  pic_time                  numeric(4, 1) NOT NULL DEFAULT 0 CHECK (pic_time >= 0 AND pic_time <= total_time),
  cross_country_time        numeric(4, 1) NOT NULL DEFAULT 0 CHECK (cross_country_time >= 0 AND cross_country_time <= total_time),
  night_time                numeric(4, 1) NOT NULL DEFAULT 0 CHECK (night_time >= 0 AND night_time <= total_time),
  actual_instrument_time    numeric(4, 1) NOT NULL DEFAULT 0 CHECK (actual_instrument_time >= 0 AND actual_instrument_time <= total_time),
  simulated_instrument_time numeric(4, 1) NOT NULL DEFAULT 0 CHECK (simulated_instrument_time >= 0 AND simulated_instrument_time <= total_time),
  day_landings_fs           smallint      NOT NULL DEFAULT 0 CHECK (day_landings_fs >= 0),
  day_landings_tg           smallint      NOT NULL DEFAULT 0 CHECK (day_landings_tg >= 0),
  night_landings_fs         smallint      NOT NULL DEFAULT 0 CHECK (night_landings_fs >= 0),
  night_landings_tg         smallint      NOT NULL DEFAULT 0 CHECK (night_landings_tg >= 0),
  instrument_approaches     smallint      NOT NULL DEFAULT 0 CHECK (instrument_approaches >= 0),
  notes                     text          ,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arrival_after_departure CHECK (arrival_time > departure_time),
  CONSTRAINT dual_and_solo_time_sum CHECK (dual_received_time + solo_time <= total_time)
);

CREATE TRIGGER flights_set_updated_at
  BEFORE UPDATE ON flights
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE flight_legs (
  leg_id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id      uuid        NOT NULL REFERENCES flights (flight_id) ON DELETE CASCADE,
  leg_order      smallint    NOT NULL,
  origin_id      uuid        NOT NULL REFERENCES airports (airport_id),
  destination_id uuid        NOT NULL REFERENCES airports (airport_id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flight_id, leg_order),
  CHECK (leg_order >= 1)
);

CREATE INDEX flights_user_date_idx ON flights (user_id, flight_date DESC);
CREATE INDEX flights_aircraft_idx ON flights (aircraft_id);
CREATE INDEX flights_instructor_idx ON flights (instructor_id);
CREATE INDEX flight_legs_origin_idx ON flight_legs (origin_id);
CREATE INDEX flight_legs_destination_idx ON flight_legs (destination_id);
CREATE INDEX airports_location_idx ON airports USING gist (airport_location);

-- migrate:down
DROP TABLE IF EXISTS flight_legs;
DROP TABLE IF EXISTS flights;
DROP TABLE IF EXISTS aircraft;
DROP TABLE IF EXISTS airports;
DROP TABLE IF EXISTS instructors;
DROP TABLE IF EXISTS users;


DROP FUNCTION IF EXISTS set_updated_at();
DROP EXTENSION IF EXISTS citext;
