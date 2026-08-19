import { getAccessToken, setAccessToken } from "./auth-store";

// El navegador siempre usa el proxy del mismo origen para conservar cookies HttpOnly.
const API_URL = "/api/v1";
let refreshPromise: Promise<string> | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message[0]
      : body?.message;
    throw new ApiError(
      message ?? "No fue posible completar la solicitud.",
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string) {
  const result = await request<{
    accessToken: string;
    user: { roles: string[]; permissions: string[] };
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(result.accessToken);
  return result.user;
}

export function register(payload: Record<string, unknown>) {
  return request<{
    id: string;
    email: string;
    verificationRequired: boolean;
    deliveryStatus: "SENT" | "FAILED";
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(token: string) {
  return request<{ success: boolean; message: string }>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(email: string) {
  return request<{ success: boolean; message: string }>(
    "/auth/resend-verification",
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export function forgotPassword(email: string) {
  return request<{ success: boolean; message: string }>(
    "/auth/forgot-password",
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export function resetPassword(token: string, password: string) {
  return request<{ success: boolean; message: string }>(
    "/auth/reset-password",
    { method: "POST", body: JSON.stringify({ token, password }) },
  );
}

export function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = request<{ accessToken: string }>("/auth/refresh", {
    method: "POST",
  })
    .then((result) => {
      setAccessToken(result.accessToken);
      return result.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function currentUser() {
  const user = await apiFetch<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
  }>("/auth/me");
  return user;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let token = getAccessToken();
  if (!token) {
    token = await refreshAccessToken().catch(() => null);
  }

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await request<T>(path, {
      ...init,
      headers,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) {
      throw error;
    }
    const refreshedToken = await refreshAccessToken().catch(() => null);
    if (refreshedToken) {
      return request<T>(path, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${refreshedToken}`,
        },
      });
    }
    throw error;
  }
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  let token = getAccessToken();
  if (!token) {
    token = await refreshAccessToken().catch(() => null);
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await request<T>(path, {
      method: "POST",
      body: formData,
      headers,
    });
  } catch (error) {
    if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) {
      throw error;
    }
    const refreshedToken = await refreshAccessToken().catch(() => null);
    if (refreshedToken) {
      return request<T>(path, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${refreshedToken}` },
      });
    }
    throw error;
  }
}

export async function logout() {
  await request<{ success: boolean }>("/auth/logout", { method: "POST" });
  setAccessToken(null);
}
