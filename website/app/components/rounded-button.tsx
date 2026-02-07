import { Link } from "react-router";

type RoundedButtonCommonProps = {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

type RoundedButtonLinkProps = RoundedButtonCommonProps & {
  to: string;
};

type RoundedButtonButtonProps = RoundedButtonCommonProps & {
  to?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type RoundedButtonProps = RoundedButtonLinkProps | RoundedButtonButtonProps;

const baseClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-accent)] bg-black text-white font-semibold tracking-wide transition-all shadow-[0_0_18px_rgba(0,0,0,0.35)] hover:bg-[#0b0b0b] hover:shadow-[0_0_28px_rgba(0,0,0,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 disabled:opacity-60 disabled:cursor-not-allowed";

function isLinkProps(props: RoundedButtonProps): props is RoundedButtonLinkProps {
  return typeof props.to === "string";
}

export function RoundedButton(props: RoundedButtonProps) {
  const { className, children } = props;
  const classes = [baseClassName, className].filter(Boolean).join(" ");

  if (isLinkProps(props)) {
    const { to, className: _className, children: _children, ...linkRest } = props;
    return (
      <Link to={to} {...linkRest} className={classes}>
        {children}
      </Link>
    );
  }

  const { className: _className, children: _children, ...buttonRest } = props;
  return (
    <button {...buttonRest} className={classes}>
      {children}
    </button>
  );
}
