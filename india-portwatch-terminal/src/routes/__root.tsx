import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { TerminalShell } from "@/components/terminal/Shell";

function NotFoundComponent() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="panel px-6 py-5 text-center">
        <div className="label-xs mb-2">SIGNAL LOST</div>
        <div className="text-2xl text-[var(--color-red)] glow-red">404 · ROUTE NOT ACQUIRED</div>
        <a href="/" className="mt-3 inline-block text-[11px] tracking-widest text-[var(--color-cyan)] border border-[var(--color-cyan)]/50 px-3 py-1">▸ RETURN TO RADAR</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="panel px-6 py-5 max-w-md">
        <div className="label-xs mb-1">SYSTEM FAULT</div>
        <div className="text-[var(--color-red)] mb-3">{error.message}</div>
        <button onClick={() => { router.invalidate(); reset(); }} className="text-[11px] tracking-widest text-[var(--color-cyan)] border border-[var(--color-cyan)]/50 px-3 py-1">▸ RETRY</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "India PortWatch — AI Maritime Command Terminal" },
      { name: "description", content: "Bloomberg-grade AI maritime command terminal for India's port network: radar, port ops, weather, SAR, NLP, model pipeline, decision simulation and fleet management." },
      { name: "author", content: "India PortWatch" },
      { property: "og:title", content: "India PortWatch — AI Maritime Command" },
      { property: "og:description", content: "AI-driven maritime command terminal for India's port network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <TerminalShell>
        <Outlet />
      </TerminalShell>
    </QueryClientProvider>
  );
}
