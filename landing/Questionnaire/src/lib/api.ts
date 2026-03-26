export interface SurveySubmissionAnswer {
  nodeId: string;
  question: string;
  label: string;
  value: string;
}

export interface SurveySubmitRequest {
  name: string;
  contact: string;
  answers: SurveySubmissionAnswer[];
}

export interface SurveySubmitResponse {
  ok: boolean;
  responseId: number;
}

export interface AdminAnswerEntry {
  question: string;
  answer: string;
}

export interface AdminSurveyResponse {
  id: number;
  name: string;
  contact: string;
  role: string;
  device: "Android" | "iOS" | "Desktop" | string;
  city: string;
  createdAt: string;
  answers: AdminAnswerEntry[];
}

export interface DistributionItem {
  name: string;
  value: number;
  fill?: string;
}

export interface AdminDashboardResponse {
  ok: boolean;
  responses: AdminSurveyResponse[];
  roleDistribution: DistributionItem[];
  deviceDistribution: DistributionItem[];
  cityDistribution: Array<{ name: string; value: number }>;
}

export interface AdminSessionResponse {
  ok: boolean;
  authenticated: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Keep payload null for non-JSON responses.
  }

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${response.status})`;
    throw new ApiError(errorMessage, response.status);
  }

  return payload as T;
}

export async function submitSurvey(payload: SurveySubmitRequest): Promise<SurveySubmitResponse> {
  return requestJson<SurveySubmitResponse>("/survey/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminLogin(password: string): Promise<void> {
  await requestJson<{ ok: boolean }>("/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminSession(): Promise<AdminSessionResponse> {
  return requestJson<AdminSessionResponse>("/admin/session", {
    method: "GET",
  });
}

export async function adminLogout(): Promise<void> {
  await requestJson<{ ok: boolean }>("/admin/logout", {
    method: "POST",
  });
}

export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return requestJson<AdminDashboardResponse>("/admin/dashboard", {
    method: "GET",
  });
}

export { ApiError };
