interface SkeletonProps {
  className?: string;
}

function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

export { Skeleton };
export type { SkeletonProps };
