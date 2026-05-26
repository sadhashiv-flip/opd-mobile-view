import { canGoBackInHistory, useNavigateBack } from "@/hooks/useNavigateBack";
import { Link, type LinkProps } from "react-router-dom";

type TransitionBackLinkProps = LinkProps &
  Readonly<{
    children: React.ReactNode;
  }>;

/**
 * In-flow back: pops history when possible (restores prior screen state), otherwise navigates to `to`.
 */
export function TransitionBackLink({ onClick, to, children, ...rest }: TransitionBackLinkProps) {
  const fallback = typeof to === "string" ? to : (to.pathname ?? undefined);
  const goBack = useNavigateBack(fallback);

  if (canGoBackInHistory()) {
    const { className, style, "aria-label": ariaLabel } = rest;
    return (
      <button
        type="button"
        className={className}
        style={style}
        aria-label={ariaLabel}
        onClick={(e) => {
          onClick?.(e as unknown as React.MouseEvent<HTMLAnchorElement>);
          goBack();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <Link {...rest} to={to} onClick={onClick}>
      {children}
    </Link>
  );
}
