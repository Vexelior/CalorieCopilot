import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <i className="bi bi-compass display-4 text-success" />
      <h1 className="h3 mt-3">Page not found</h1>
      <p className="text-body-secondary">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-success">Go home</Link>
    </div>
  );
}
