"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthHeaders, sessionKey, SessionUser } from "../../lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, name, password })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { user: SessionUser };
      window.localStorage.setItem(sessionKey, JSON.stringify(data.user));

      if (inviteToken) {
        const accepted = await acceptInvite(inviteToken, data.user);

        if (accepted) {
          router.replace("/");
          return;
        }
      }

      router.replace("/onboard");
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
          <p className="eyebrow">New workspace</p>
          <h1>Create your account</h1>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          <label className="field">
            Full name
            <input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex Morgan"
              required
              value={name}
            />
          </label>
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
              autoComplete="new-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Use at least 6 characters"
              required
              type="password"
              value={password}
            />
          </label>

          {message && <div className="notice errorNotice">{message}</div>}

          <button className="primaryButton" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="authSwitch">
          Already have an account?{" "}
          <Link href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}` : "/login"}>
            Log in
          </Link>
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

async function acceptInvite(token: string, user: SessionUser) {
  try {
    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: getAuthHeaders(user),
      body: JSON.stringify({ token })
    });

    return response.ok;
  } catch {
    return false;
  }
}
