import type { CSSProperties, ReactNode } from "react";

const MOBILE_MAX_WIDTH = 430;

type MobileShellProps = Readonly<{
  children: ReactNode;
}>;

/** Layout shell: constrains the app to a phone-width column (SRP: layout only). */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <div
      className="mobile-app-root"
      style={
        {
          "--mobile-frame-max-width": `${MOBILE_MAX_WIDTH}px`,
        } as CSSProperties
      }
    >
      <div className="mobile-frame">{children}</div>
    </div>
  );
}
