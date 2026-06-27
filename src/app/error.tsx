"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled UI error:", error);
  }, [error]);

  return (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center gap-6 bg-[#0a0a0a] text-white px-6 text-center">
      <div>
        <h2 className="text-lg font-bold tracking-widest uppercase">Something went wrong</h2>
        <p className="mt-2 text-sm text-white/50">An unexpected error occurred while rendering this view.</p>
      </div>
      <button
        onClick={reset}
        className="px-6 py-3 rounded-2xl bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-white/90 active:scale-[0.98] transition-all"
      >
        Try again
      </button>
    </div>
  );
}
