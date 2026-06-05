import type { CSSProperties, ReactNode } from "react";
import { SplashCursor } from "@/components/effects/SplashCursor";

const MOBILE_MAX_WIDTH = 480;
const SPLASH_CURSOR_ENABLED = import.meta.env.VITE_ENABLE_SPLASH_CURSOR === "true";

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
      {SPLASH_CURSOR_ENABLED ? (
        <SplashCursor RAINBOW_MODE={false} COLOR="#ff5224" />
      ) : null}
      <div className="mobile-frame">{children}</div>
    </div>
  );
}
