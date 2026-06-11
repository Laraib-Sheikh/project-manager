"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, sessionKey, SessionUser } from "../../lib/session";

export default function OnboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const storedSession = window.localStorage.getItem(sessionKey);

    if (!storedSession) {
      router.replace("/login");
      return;
    }

    try {
      const user = JSON.parse(storedSession) as SessionUser;

      if (!user.id) {
        window.localStorage.removeItem(sessionKey);
        router.replace("/login");
        return;
      }

      setCurrentUser(user);
      checkExistingProjects(user);
    } catch {
      window.localStorage.removeItem(sessionKey);
      router.replace("/login");
    }
  }, [router]);

  async function checkExistingProjects(user: SessionUser) {
    try {
      const response = await fetch("/api/projects", {
        headers: getAuthHeaders(user)
      });

      if (response.ok) {
        const data = (await response.json()) as { projects: { id: string }[] };

        if (data.projects.length > 0) {
          router.replace("/");
          return;
        }
      }
    } catch {
      // Allow onboarding to continue if the check fails.
    } finally {
      setIsCheckingAuth(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser) {
      return;
    }

    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: getAuthHeaders(currentUser),
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      router.replace("/");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCheckingAuth || !currentUser) {
    return (
      <main className="authStatus">
        <div className="notice">Preparing your workspace...</div>
      </main>
    );
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
          <p className="eyebrow">Welcome, {currentUser.name}</p>
          <h1>Set up your first project</h1>
          <p>Add the project you manage so your tasks stay in your own workspace.</p>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          <label className="field">
            Project name
            <input
              onChange={(event) => setName(event.target.value)}
              placeholder="Website Redesign"
              required
              value={name}
            />
          </label>
          <label className="field">
            Description
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this project about?"
              rows={3}
              value={description}
            />
          </label>

          {message && <div className="notice errorNotice">{message}</div>}

          <button className="primaryButton" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating project..." : "Continue to dashboard"}
          </button>
        </form>
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
