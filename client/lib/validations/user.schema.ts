import { z } from "zod";

export const updateProfileSchema = z.object({
  username: z
    .string()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .max(50)
    .optional(),
  email: z.string().email("Email không hợp lệ").optional(),
});

export type UpdateProfileFormValues = z.infer<typeof updateProfileSchema>;
