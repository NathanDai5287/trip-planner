import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-charcoal font-body"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-lg border border-border bg-cream px-4 py-2.5
            text-sm text-charcoal font-body placeholder:text-muted
            transition-colors duration-150
            focus:bg-stone-light focus:border-terracotta focus:ring-2 focus:ring-terracotta/20
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-danger focus:border-danger focus:ring-danger/20" : ""}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger font-body">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
