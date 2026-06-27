import React from "react";

export default function BoardingPassSkeleton() {
    return (
        <div className="relative w-full max-w-sm h-44">
            <div className="relative w-full h-full glass rounded-3xl overflow-hidden border border-white/5 flex flex-col">
                <div className="flex-1 p-5 flex flex-row items-center justify-between bg-black/40 backdrop-blur-md relative">

                    {/* LEFT: Origin Skeleton */}
                    <div className="flex flex-col items-start justify-between h-full z-10 w-1/3 py-1">
                        <div>
                            <div className="h-8 w-16 bg-white/10 rounded animate-shimmer" />
                            <div className="h-3 w-20 bg-white/5 rounded mt-2 animate-shimmer" />
                        </div>
                        <div>
                            <div className="h-2 w-16 bg-white/5 rounded mb-1 animate-shimmer" />
                            <div className="h-6 w-14 bg-white/10 rounded animate-shimmer" />
                        </div>
                    </div>

                    {/* CENTER: Flight Info Skeleton */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
                        <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-4 h-4 rounded-full bg-white/10 animate-shimmer" />
                                <div className="h-4 w-12 bg-white/10 rounded animate-shimmer" />
                            </div>
                            <div className="w-24 h-[1px] bg-white/10" />
                        </div>
                    </div>

                    {/* RIGHT: Destination Skeleton */}
                    <div className="flex flex-col items-end justify-between h-full z-10 w-1/3 text-right py-1">
                        <div>
                            <div className="h-8 w-16 bg-white/10 rounded animate-shimmer" />
                            <div className="h-3 w-20 bg-white/5 rounded mt-2 animate-shimmer" />
                        </div>
                        <div>
                            <div className="h-2 w-16 bg-white/5 rounded mb-1 animate-shimmer" />
                            <div className="h-6 w-14 bg-white/10 rounded animate-shimmer" />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
