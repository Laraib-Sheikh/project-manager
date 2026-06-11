import { ReactNode, Suspense } from "react";

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="authStatus"><div className="notice">Loading...</div></main>}>{children}</Suspense>;
}
