"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message ?? "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="text-sm text-primary underline hover:no-underline"
      >
        Try again
      </button>
    </div>
  );
}
