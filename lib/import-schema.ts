import { z } from "zod";

export const importDestinationSchema = z.object({
  osmId: z.string().optional(),
  name: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().optional().default(""),
  order: z.number().int().min(0),
});

export const importTripSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  destinations: z.array(importDestinationSchema),
  exportedAt: z.string().optional(),
  version: z.number().optional(),
});

export type ImportTrip = z.infer<typeof importTripSchema>;
