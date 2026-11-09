'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="text-center py-5">
      <i className="bi bi-exclamation-triangle display-4 text-danger" />
      <h1 className="h3 mt-3">Something went wrong</h1>
      <p className="text-body-secondary">An error occurred while processing your request.</p>
      <button type="button" className="btn btn-success" onClick={reset}>Try again</button>
    </div>
  );
}
