"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const sessionKey = "orbit-pm-session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(sessionKey)) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { user: { email: string; name: string } };
      window.localStorage.setItem(sessionKey, JSON.stringify(data.user));
      router.replace("/");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authPanel">
        <div className="authBrand">
          <span className="brandMark">O</span>
          <div>
            <strong>Orbit PM</strong>
            <span>Project command center</span>
          </div>
        </div>

        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Log in to your dashboard</h1>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          <label className="field">
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="field">
            Password
            <input
              autoComplete="current-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </label>

          {message && <div className="notice errorNotice">{message}</div>}

          <button className="primaryButton" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="authSwitch">
          Need an account? <Link href="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}

async function readApiError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
