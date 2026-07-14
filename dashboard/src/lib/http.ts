import axios, { type AxiosInstance } from "axios";

// ===================================================================
// Tək axios instance (plan bölmə 3, "Qətiləşmiş qərarlar"). YALNIZ
// response interceptor — backend hər yerdə `{ data, error }` qaytarır,
// bunu ya çılpaq `data`-ya, ya da `ApiError`-a çeviririk. Request
// interceptor YOXDUR (auth yoxdur) — `X-Control-Token` yalnız
// `api/client.ts`-dəki 2 control çağırışında, birbaşa header kimi verilir.
// ===================================================================

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiEnvelope<T> {
  data: T | null;
  error: { message: string } | null;
}

export const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
});

http.interceptors.response.use(
  (response) => {
    const envelope = response.data as ApiEnvelope<unknown>;
    if (envelope.error) {
      return Promise.reject(new ApiError(envelope.error.message, response.status));
    }
    response.data = envelope.data;
    return response;
  },
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const envelope = error.response?.data as ApiEnvelope<unknown> | undefined;
      const message = envelope?.error?.message ?? error.message;
      return Promise.reject(new ApiError(message, error.response?.status));
    }
    return Promise.reject(error);
  },
);
