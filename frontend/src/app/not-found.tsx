import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-faint">404</p>
      <h1 className="mt-1 text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-[13px] text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 text-[13px] font-medium underline underline-offset-4">Go home</Link>
    </div>
  );
}
