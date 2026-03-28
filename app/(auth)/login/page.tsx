"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";

type FormState = { error?: string } | undefined;

async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  return await login(formData);
}

export default function LoginPage() {
  const [state, dispatch, isPending] = useActionState<FormState, FormData>(
    loginAction,
    undefined
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream topo-pattern px-4">
      <div className="w-full max-w-md animate-fade-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-terracotta/10 mb-4">
            <svg
              className="w-7 h-7 text-terracotta"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-semibold text-charcoal tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-muted text-sm">
            Sign in to continue your expedition
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-border rounded-[var(--radius)] shadow-sm p-8">
          <form action={dispatch} className="space-y-5">
            {state?.error && (
              <div className="rounded-[var(--radius)] bg-danger/5 border border-danger/20 px-4 py-3 text-sm text-danger">
                {state.error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-charcoal mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="explorer@expedition.co"
                className="w-full rounded-[var(--radius)] border border-border bg-stone-light/50 px-4 py-2.5 text-sm text-charcoal placeholder:text-muted/60 transition-colors focus:border-terracotta focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-charcoal mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-[var(--radius)] border border-border bg-stone-light/50 px-4 py-2.5 text-sm text-charcoal placeholder:text-muted/60 transition-colors focus:border-terracotta focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/20"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-[var(--radius)] bg-terracotta px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-terracotta-dark focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
