const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let toastCallback: ((msg: string, type: "success" | "error") => void) | null = null;
let currentToken: string | null = null;

export function setToastHandler(fn: (msg: string, type: "success" | "error") => void) {
  toastCallback = fn;
}

export function setAuthToken(token: string | null) {
  currentToken = token;
}

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: object | string | FormData };

export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const headers: Record<string, string> = {};

  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  let finalOptions: RequestInit = { ...options, headers } as RequestInit;

  if (options?.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    finalOptions.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, finalOptions);
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      const msg = error.error || `Erreur ${res.status}`;
      
      if (res.status === 403) {
        if (toastCallback) toastCallback("Permission insuffisante", "error");
      } else if (toastCallback) {
        toastCallback(msg, "error");
      }
      throw new Error(msg);
    }
    
    const data = await res.json();
    if (data.success && toastCallback) {
      toastCallback(data.message || "Opération réussie", "success");
    }
    return data;
  } catch (e: any) {
    console.error(`API Error ${path}:`, e.message);
    throw e;
  }
}