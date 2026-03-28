"use client";

import { Toaster } from "react-hot-toast";

function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      gutter={12}
      toastOptions={{
        duration: 4000,
        style: {
          background: "var(--cream)",
          color: "var(--charcoal)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-body), system-ui, sans-serif",
          fontSize: "0.875rem",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        },
        success: {
          iconTheme: {
            primary: "var(--forest)",
            secondary: "var(--cream)",
          },
        },
        error: {
          iconTheme: {
            primary: "var(--danger)",
            secondary: "var(--cream)",
          },
        },
      }}
    />
  );
}

export { ToastProvider };
