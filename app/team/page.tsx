"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Project } from "../../lib/project-data";
import { PendingInvitationView, TeamMemberView } from "../../lib/member-data";
import { getAuthHeaders, sessionKey, SessionUser } from "../../lib/session";

type TeamResponse = {
  members: TeamMemberView[];
  pending: PendingInvitationView[];
  ownedProjects: Project[];
};

export default function TeamPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [team, setTeam] = useState<TeamResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteProjectId, setInviteProjectId] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
      setIsCheckingAuth(false);
      void loadTeam(user);
    } catch {
      window.localStorage.removeItem(sessionKey);
      router.replace("/login");
    }
  }, [router]);

  async function loadTeam(user = currentUser) {
    if (!user) {
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/team", {
        headers: getAuthHeaders(user)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const data = (await response.json()) as TeamResponse;
      setTeam(data);
      setInviteProjectId((current) => current || data.ownedProjects[0]?.id || "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const uniqueMembers = useMemo(() => {
    if (!team) {
      return [];
    }

    const seen = new Map<string, TeamMemberView>();

    for (const member of team.members) {
      const key = `${member.userId}-${member.projectId}`;

      if (!seen.has(key)) {
        seen.set(key, member);
      }
    }

    return [...seen.values()];
  }, [team]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentUser || !inviteProjectId) {
      return;
    }

    setIsInviting(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(`/api/projects/${inviteProjectId}/invitations`, {
        method: "POST",
        headers: getAuthHeaders(currentUser),
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = (await response.json()) as {
        message?: string;
        emailSent?: boolean;
        emailLogged?: boolean;
        emailAuthFailed?: boolean;
        emailWarning?: string;
        acceptUrl?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to send invitation.");
      }

      if (data.emailSent) {
        setMessage(`Invitation sent to ${inviteEmail}.`);
      } else if (data.emailAuthFailed && data.acceptUrl) {
        setMessage(
          `Invitation created, but Gmail login failed. Create a Gmail App Password and update SMTP_PASS in .env.local, then restart the server. Share this link manually: ${data.acceptUrl}`
        );
      } else if (data.emailLogged && data.acceptUrl) {
        setMessage(`SMTP not configured — copy this invite link: ${data.acceptUrl}`);
      } else {
        setMessage(`Invitation created for ${inviteEmail}.`);
      }

      setInviteEmail("");
      setShowInvite(false);
      await loadTeam(currentUser);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsInviting(false);
    }
  }

  async function revokeInvite(invitationId: string) {
    if (!currentUser) {
      return;
    }

    setErrorMessage("");

    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: "DELETE",
        headers: getAuthHeaders(currentUser)
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await loadTeam(currentUser);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(sessionKey);
    router.replace("/login");
  }

  if (isCheckingAuth || !currentUser) {
    return (
      <main className="authStatus">
        <div className="notice">Checking your workspace session...</div>
      </main>
    );
  }

  const ownedProjects = team?.ownedProjects ?? [];
  const pendingCount = team?.pending.length ?? 0;

  return (
    <main className="shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="brand">
          <span className="brandMark">O</span>
          <div>
            <strong>Orbit PM</strong>
            <span>Management suite</span>
          </div>
        </div>

        <nav className="navList">
          <Link href="/">Dashboard</Link>
          <Link className="active" href="/team">Team</Link>
        </nav>

        <div className="userPanel">
          <span>Signed in as</span>
          <strong>{currentUser.name}</strong>
          <button onClick={handleLogout} type="button">Log out</button>
        </div>
      </aside>

      <section className="workspace teamWorkspace">
        <header className="teamHeader">
          <div>
            <p className="eyebrow">Collaboration</p>
            <h1>Team Directory</h1>
            <p className="teamSubtitle">Manage collaborators, roles, and pending invitations across your projects.</p>
          </div>
          <button
            className="primaryButton"
            disabled={ownedProjects.length === 0}
            onClick={() => setShowInvite(true)}
            type="button"
          >
            + Invite Member
          </button>
        </header>

        <section className="metrics teamMetrics">
          <Metric label="Total members" value={uniqueMembers.length.toString()} />
          <Metric label="Your projects" value={ownedProjects.length.toString()} />
          <Metric label="Pending invitations" value={pendingCount.toString()} tone={pendingCount ? "danger" : "default"} />
          <Metric label="Shared access" value={team ? (team.members.length - uniqueMembers.length + ownedProjects.length).toString() : "0"} />
        </section>

        {message && <div className="notice successNotice">{message}</div>}
        {errorMessage && <div className="notice errorNotice" role="alert">{errorMessage}</div>}

        {isLoading ? (
          <div className="notice">Loading team directory...</div>
        ) : (
          <>
            <section className="teamSection">
              <div className="teamSectionHeader">
                <h2>Active members</h2>
              </div>
              <div className="memberGrid">
                {uniqueMembers.map((member) => (
                  <article className="memberCard" key={`${member.userId}-${member.projectId}`}>
                    <div className="memberAvatar">{getInitials(member.name)}</div>
                    <div className="memberInfo">
                      <strong>{member.name}</strong>
                      <span className="memberRole">{member.role.toUpperCase()}</span>
                      <span className="memberMeta">{member.projectName}</span>
                      <span className="memberEmail">{member.email}</span>
                    </div>
                  </article>
                ))}
                <button className="memberCard addMemberCard" onClick={() => setShowInvite(true)} type="button">
                  <span className="addMemberIcon">+</span>
                  <strong>Add Member</strong>
                  <span>Start collaborating</span>
                </button>
              </div>
            </section>

            {team && team.pending.length > 0 && (
              <section className="teamSection">
                <div className="teamSectionHeader">
                  <h2>Pending invitations</h2>
                </div>
                <div className="pendingList">
                  {team.pending.map((invite) => (
                    <div className="pendingRow" key={invite.id}>
                      <div>
                        <strong>{invite.email}</strong>
                        <span>{invite.projectName} · {invite.role} · invited by {invite.invitedByName}</span>
                      </div>
                      <button className="ghostButton dangerButton" onClick={() => revokeInvite(invite.id)} type="button">
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {showInvite && (
          <div className="modalBackdrop" onClick={() => setShowInvite(false)} role="presentation">
            <div className="modalPanel" onClick={(event) => event.stopPropagation()} role="dialog" aria-labelledby="invite-title">
              <div className="formHeader">
                <div>
                  <p className="eyebrow">Invite</p>
                  <h2 id="invite-title">Invite team member</h2>
                </div>
                <button className="ghostButton" onClick={() => setShowInvite(false)} type="button">Close</button>
              </div>

              <form className="authForm" onSubmit={handleInvite}>
                <label className="field">
                  Email address
                  <input
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="name@company.com"
                    required
                    type="email"
                    value={inviteEmail}
                  />
                </label>
                <label className="field">
                  Project
                  <select onChange={(event) => setInviteProjectId(event.target.value)} required value={inviteProjectId}>
                    {ownedProjects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Role
                  <select onChange={(event) => setInviteRole(event.target.value)} value={inviteRole}>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <button className="primaryButton" disabled={isInviting || ownedProjects.length === 0} type="submit">
                  {isInviting ? "Sending..." : "Send invitation"}
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, tone = "default", value }: { label: string; tone?: "default" | "danger"; value: string }) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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
