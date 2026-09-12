import { type ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:
    "border border-brand-300/20 bg-brand-400 text-[#10140f] hover:bg-brand-300",
  secondary:
    "border border-white/12 bg-white/[.045] text-white hover:border-white/22 hover:bg-white/[.075]",
  ghost: "bg-transparent text-white/80 hover:text-white hover:bg-white/5",
  danger: "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-lg",
  lg: "px-6 py-3.5 text-sm rounded-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "cursor-target inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
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
