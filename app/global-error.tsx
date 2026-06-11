"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="errorShell">
          <section className="errorPanel">
            <p className="eyebrow">Workspace error</p>
            <h1>Something interrupted the dashboard.</h1>
            <p>Refresh the workspace and your saved browser data will stay intact.</p>
            <button className="primaryButton" onClick={reset} type="button">
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
