import { z } from "zod";

// POST /instructors
export const CreateInstructorSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
});
export type CreateInstructor = z.infer<typeof CreateInstructorSchema>;

// PATCH /instructors/:id
export const UpdateInstructorSchema = CreateInstructorSchema.partial();
export type UpdateInstructor = z.infer<typeof UpdateInstructorSchema>;
