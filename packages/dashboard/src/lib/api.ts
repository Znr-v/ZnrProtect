const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let toastCallback: ((msg: string, type: "success" | "error") => void) | null = null;

export function setToastHandler(fn: (msg: string, type: "success" | "error") => void) {
  toastCallback = fn;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let finalOptions: RequestInit = { ...options, headers };

  if (options?.body && typeof options.body === "object") {
    finalOptions.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, finalOptions);
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Erreur inconnue" }));
      const msg = error.error || `Erreur ${res.status}`;
      if (toastCallback) toastCallback(msg, "error");
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