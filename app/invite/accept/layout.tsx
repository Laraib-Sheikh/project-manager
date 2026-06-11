import { ReactNode, Suspense } from "react";

export default function InviteAcceptLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="authStatus"><div className="notice">Loading invitation...</div></main>}>{children}</Suspense>;
}
