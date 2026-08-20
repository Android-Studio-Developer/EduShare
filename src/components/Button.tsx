import { type ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "border border-blue-300/20 bg-brand-500 text-white hover:bg-brand-400 shadow-[0_10px_35px_-15px_rgba(65,105,225,0.8)]",
  secondary:
    "bg-white/[.055] text-white border border-white/10 hover:border-brand-300/35 hover:bg-white/[.085]",
  ghost: "bg-transparent text-white/80 hover:text-white hover:bg-white/5",
  danger: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-7 py-3.5 text-base rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "cursor-target inline-flex items-center justify-center gap-2 font-mono font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97]",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export default Button;
