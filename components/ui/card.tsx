import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: boolean;
  children: ReactNode;
}

function Card({ accent = false, children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`
        bg-cream rounded-xl border border-border shadow-sm
        ${accent ? "border-l-4 border-l-terracotta" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function CardHeader({ children, className = "", ...props }: CardHeaderProps) {
  return (
    <div className={`px-6 pt-6 pb-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function CardContent({ children, className = "", ...props }: CardContentProps) {
  return (
    <div className={`px-6 pb-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardContent };
export type { CardProps, CardHeaderProps, CardContentProps };
