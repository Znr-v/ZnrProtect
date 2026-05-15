"use client";
import { SessionProvider } from "next-auth/react";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setToastHandler } from "@/lib/api";

type ToastContextType = {
  toast: { message: string; type: "success" | "error" } | null;
  showToast: (message: string, type: "success" | "error") => void;
};

const ToastContext = createContext<ToastContextType>({ toast: null, showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    setToastHandler(showToast);
  }, []);

  return (
    <SessionProvider>
      <ToastContext.Provider value={{ toast, showToast }}>
        {children}
        {toast && (
          <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 animate-fade-in ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}>
            {toast.message}
          </div>
        )}
      </ToastContext.Provider>
    </SessionProvider>
  );
}