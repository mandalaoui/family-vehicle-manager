import { ToastProvider } from "@/components/ui/Toast";
import { SiteFooter } from "@/components/SiteFooter";

/** Wraps every route: page content grows to fill the screen, and the footer always sits at the bottom. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </ToastProvider>
  );
}
