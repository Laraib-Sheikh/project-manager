"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthHeaders, sessionKey, SessionUser } from "../../../lib/session";

type InvitePreview = {
  invitation: {
    email: string;
    role: string;
    status: string;
    expiresAt: string;
  };
  project: { id: string; name: string } | null;
};

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const storedSession = window.localStorage.getItem(sessionKey);

    if (storedSession) {
      try {
        setCurrentUser(JSON.parse(storedSession) as SessionUser);
      } catch {
        window.localStorage.removeItem(sessionKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setMessage("Invalid invitation link.");
      setIsLoading(false);
      return;
    }

    void loadPreview();
  }, [token]);

  async function loadPreview() {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`);

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setPreview((await response.json()) as InvitePreview);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function acceptInvite() {
    if (!currentUser || !token) {
      router.push(`/register?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(preview?.invitation.email ?? "")}`);
      return;
    }

    setIsAccepting(true);
    setMessage("");

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: getAuthHeaders(currentUser),
        body: JSON.stringify({ token })
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as { project: { name: string } | null };
      router.replace(data.project ? `/?joined=${encodeURIComponent(data.project.name)}` : "/");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authPanel invitePanel">
        <div className="authBrand">
          <span className="brandMark">O</span>
          <div>
            <strong>Orbit PM</strong>
            <span>Project invitation</span>
          </div>
        </div>

        {isLoading ? (
          <div className="notice">Loading invitation...</div>
        ) : preview?.project ? (
          <>
            <div>
              <p className="eyebrow">You&apos;re invited</p>
              <h1>Join {preview.project.name}</h1>
              <p className="teamSubtitle">
                You&apos;ve been invited as <strong>{preview.invitation.role}</strong> for {preview.invitation.email}.
              </p>
            </div>

            {message && <div className="notice errorNotice" role="alert">{message}</div>}

            {currentUser ? (
              <button className="primaryButton" disabled={isAccepting} onClick={acceptInvite} type="button">
                {isAccepting ? "Joining..." : "Accept invitation"}
              </button>
            ) : (
              <div className="inviteActions">
                <Link className="primaryButton inviteButton" href={`/register?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(preview.invitation.email)}`}>
                  Create account to join
                </Link>
                <Link className="ghostButton inviteButton" href={`/login?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(preview.invitation.email)}`}>
                  Log in to accept
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="notice errorNotice" role="alert">
            {message || "This invitation is invalid or has expired."}
          </div>
        )}
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
