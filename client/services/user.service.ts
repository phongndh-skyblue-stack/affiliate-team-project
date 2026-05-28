import axiosInstance from "@/lib/axios";
import type { User, UpdateProfileRequest } from "@/types/user.types";

export const userService = {
  getMe: async (): Promise<User> => {
    const response = await axiosInstance.get<User>("/users/me");
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await axiosInstance.put<User>("/users/me", data);
    return response.data;
  },
};
