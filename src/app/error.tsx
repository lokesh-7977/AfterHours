"use client";

/** Fallback for unexpected server/render errors; details stay in the server log. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page max-w-lg py-20 text-center">
      <h1 className="heading">Something went <span className="text-festival accent">wrong</span></h1>
      <p className="muted mt-2">Please try again. If it keeps happening, contact the organizers.</p>
      <button className="btn btn-primary mt-6" onClick={() => reset()}>Try again</button>
    </div>
  );
}
