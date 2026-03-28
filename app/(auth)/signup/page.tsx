"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";

type FormState = { error?: string } | undefined;

async function signupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  return await signup(formData);
}

export default function SignupPage() {
  const [state, dispatch, isPending] = useActionState<FormState, FormData>(
    signupAction,
    undefined
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream topo-pattern px-4">
      <div className="w-full max-w-md animate-fade-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-forest/10 mb-4">
            <svg
              className="w-7 h-7 text-forest"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.73-3.558"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-semibold text-charcoal tracking-tight">
            Start your journey
          </h1>
          <p className="mt-2 text-muted text-sm">
            Create an account to plan your next expedition
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
                htmlFor="name"
                className="block text-sm font-medium text-charcoal mb-1.5"
              >
                Name{" "}
                <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Amelia Earhart"
                className="w-full rounded-[var(--radius)] border border-border bg-stone-light/50 px-4 py-2.5 text-sm text-charcoal placeholder:text-muted/60 transition-colors focus:border-terracotta focus:bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/20"
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Min. 6 characters"
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
                  Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-terracotta hover:text-terracotta-dark transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
