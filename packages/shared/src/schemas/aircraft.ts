import { z } from "zod";

// Reusable field rules
const TailNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,10}$/, "Invalid tail number");

// POST /aircraft
export const CreateAircraftSchema = z.object({
  tailNumber: TailNumber,
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  year: z.number().int().min(1903).max(new Date().getFullYear() + 1).optional(),
  aircraftClass: z.enum(["single_engine_land", "multi_engine_land"]),
  isTailwheel: z.boolean().optional(),
  isComplex: z.boolean().optional(),
  isHighPerf: z.boolean().optional(),
});
export type CreateAircraft = z.infer<typeof CreateAircraftSchema>;

// PATCH /aircraft/:id
export const UpdateAircraftSchema = CreateAircraftSchema.omit({ tailNumber: true }).partial();
export type UpdateAircraft = z.infer<typeof UpdateAircraftSchema>;

// GET /aircraft?tail=N12
export const AircraftSearchSchema = z.object({
  tail: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,10}$/, "Invalid tail number search"),
});
export type AircraftSearch = z.infer<typeof AircraftSearchSchema>;