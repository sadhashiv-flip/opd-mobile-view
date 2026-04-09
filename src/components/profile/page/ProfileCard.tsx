import type { ReactNode } from "react";

type ProfileCardProps = Readonly<{
  title?: string;
  titleId?: string;
  ariaLabel?: string;
  children: ReactNode;
  className?: string;
}>;

export function ProfileCard({
  title,
  titleId,
  ariaLabel,
  children,
  className = "",
}: ProfileCardProps) {
  return (
    <section
      className={`profile-page__sheet ${className}`.trim()}
      aria-label={ariaLabel}
      {...(titleId ? { "aria-labelledby": titleId } : {})}
    >
      {title ? (
        <h3 id={titleId} className="profile-page__sheet-title">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
