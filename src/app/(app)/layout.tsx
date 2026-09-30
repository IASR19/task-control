"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Shell } from "@/components/shell";
import { Spinner } from "@/components/spinner";
import { withNext } from "@/lib/next-path";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace(withNext("/login", pathname === "/quadro" ? null : pathname));
  }, [ready, user, router, pathname]);

  if (!ready || !user) {
    return <Spinner label="Conferindo sessão…" />;
  }

  return <Shell>{children}</Shell>;
}
