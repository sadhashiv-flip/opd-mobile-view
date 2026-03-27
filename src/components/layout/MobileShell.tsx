import type { ReactNode } from "react";

const MOBILE_MAX_WIDTH = 430;

type MobileShellProps = Readonly<{
  children: ReactNode;
}>;

/** Layout shell: constrains the app to a phone-width column (SRP: layout only). */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="mobile-app-root">
      <div className="mobile-frame" style={{ maxWidth: MOBILE_MAX_WIDTH }}>
        {children}
      </div>
    </div>
  );
}
