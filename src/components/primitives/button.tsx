import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost" | "solid";
  size?: "sm" | "md";
  icon?: ReactNode;
  iconRight?: ReactNode;
};

/** Ghost (default) or solid variant. Accepts icon, iconRight, children. */
export function Button({
  variant = "ghost",
  size = "sm",
  icon,
  iconRight,
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = ["mdv-btn", `mdv-btn--${variant}`, `mdv-btn--${size}`];
  if (className) classes.push(className);
  return (
    <button {...rest} className={classes.join(" ")}>
      {icon ? <span className="mdv-btn__icon">{icon}</span> : null}
      {children ? <span className="mdv-btn__label">{children}</span> : null}
      {iconRight ? <span className="mdv-btn__icon">{iconRight}</span> : null}
    </button>
  );
}
