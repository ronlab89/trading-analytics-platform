import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link className="underline" to="/">
        Back to the start
      </Link>
    </main>
  );
}
