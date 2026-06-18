import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "react-router";

type ButtonVariant = "primary" | "secondary" | "surface" | "ghost";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90 focus-visible:ring-1 focus-visible:ring-[var(--color-border)]",
  secondary:
    "border border-[var(--color-border)] bg-transparent text-[var(--color-text)] hover:bg-[var(--color-hover)] focus-visible:ring-1 focus-visible:ring-[var(--color-border)]",
  surface:
    "border border-[#1e1e23] bg-[#121216] text-[var(--color-text)] hover:border-[#37373b] hover:bg-[#1e1e23] focus-visible:ring-1 focus-visible:ring-[var(--color-border)]",
  ghost:
    "border-l border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus-visible:ring-1 focus-visible:ring-[var(--color-border)]",
};

const buttonBase =
  "inline-flex items-center justify-center gap-1 rounded-none pl-3 pr-2.5 py-1 font-medium no-underline transition-colors";

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

type ButtonStyleProps = {
  variant?: ButtonVariant;
  className?: string;
};

type ButtonProps = ButtonStyleProps &
  ComponentPropsWithoutRef<"button"> & {
    children: ReactNode;
  };

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonBase, variantClasses[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = ButtonStyleProps & {
  children: ReactNode;
} & (
    | ({ to: string; href?: never } & Omit<
        ComponentPropsWithoutRef<typeof Link>,
        "className" | "children" | "to"
      >)
    | ({ href: string; to?: never } & Omit<
        ComponentPropsWithoutRef<"a">,
        "className" | "children" | "href"
      >)
  );

export function ButtonLink({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonLinkProps) {
  const classes = cn(buttonBase, variantClasses[variant], className);

  if ("to" in props && props.to) {
    const { to, ...linkProps } = props;
    return (
      <Link to={to} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { href, ...anchorProps } = props as Extract<
    ButtonLinkProps,
    { href: string }
  >;

  return (
    <a href={href} className={classes} {...anchorProps}>
      {children}
    </a>
  );
}
