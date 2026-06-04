import axiosInstance from "@/lib/axios";
import type {
  ProxyCreate,
  ProxyListResponse,
  ProxyResponse,
  ProxyUpdate,
} from "@/types/proxy.types";

export const proxyService = {
  list(): Promise<ProxyListResponse> {
    return axiosInstance.get("/proxies").then((r) => r.data);
  },

  create(data: ProxyCreate): Promise<ProxyResponse> {
    return axiosInstance.post("/proxies", data).then((r) => r.data);
  },

  update(id: string, data: ProxyUpdate): Promise<ProxyResponse> {
    return axiosInstance.put(`/proxies/${id}`, data).then((r) => r.data);
  },

  delete(id: string): Promise<void> {
    return axiosInstance.delete(`/proxies/${id}`).then(() => undefined);
  },
};
