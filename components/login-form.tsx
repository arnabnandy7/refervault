"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="login-form" aria-busy={pending}>
      <div className="field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          maxLength={254}
          required
          disabled={pending}
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <div className="password-input">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            maxLength={1024}
            required
            disabled={pending}
            aria-describedby={state.error ? "login-error" : undefined}
          />
          <button
            type="button"
            className="visibility-button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {visible && (
                <path d="m3 3 18 18" stroke="currentColor" strokeWidth="1.5" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {state.error && (
        <p className="form-error" id="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="submit-button" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in to your vault"}
        <span aria-hidden="true">{pending ? "◌" : "↗"}</span>
      </button>
      <p className="form-caption">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="7"
            width="8"
            height="6"
            rx="1.5"
            stroke="currentColor"
          />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" />
        </svg>
        A private space for your referrals.
      </p>
    </form>
  );
}
