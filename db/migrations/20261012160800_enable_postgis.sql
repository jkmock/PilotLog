-- migrate:up
DROP EXTENSION IF EXISTS postgis_tiger_geocoder;
DROP EXTENSION IF EXISTS postgis_topology;
DROP EXTENSION IF EXISTS fuzzystrmatch;

CREATE EXTENSION IF NOT EXISTS postgis;

-- migrate:down
DROP EXTENSION IF EXISTS postgis;