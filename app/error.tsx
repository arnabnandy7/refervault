"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>A brief interruption.</h1>
      <p>We couldn’t connect to your workspace. Please try again.</p>
      <button className="submit-button" onClick={reset}>
        Try again ↗
      </button>
    </main>
  );
}
