import { z } from "zod";
import { AIRPORTS } from "@/data/airports";

const wallClock = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Expected wall-clock YYYY-MM-DDTHH:mm");

const iataCode = z
  .string()
  .transform((s) => s.toUpperCase())
  .refine((code) => AIRPORTS[code] !== undefined, "Unknown airport code");

/** Schema for creating a flight. */
export const createFlightSchema = z.object({
  origin_code: iataCode,
  origin_city: z.string().min(1),
  destination_code: iataCode,
  destination_city: z.string().min(1),
  departure_time: wallClock,
  arrival_time: wallClock,
  flight_number: z.string().min(1).nullable().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  type: z.enum(["past", "future"]).optional(),
  confirmed_at: z.string().nullable().optional(),
});

/** Schema for updating a flight (any subset of mutable fields). */
export const updateFlightSchema = createFlightSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  "No fields to update",
);

export type CreateFlightPayload = z.infer<typeof createFlightSchema>;
export type UpdateFlightPayload = z.infer<typeof updateFlightSchema>;
