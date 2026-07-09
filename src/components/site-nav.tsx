"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const links = [
  { href: "/studio", label: "Studio" },
  { href: "/library", label: "Library" },
  { href: "/history", label: "History" },
];

export function SiteNav({
  userEmail,
  actions,
}: {
  userEmail?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b hairline bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-6 px-5 sm:h-16 sm:px-8">
        <Link
          href="/"
          className="font-display text-xl tracking-tight sm:text-2xl"
        >
          Atelier
        </Link>

        <nav aria-label="Primary" className="flex items-center gap-5 sm:gap-8">
          {links.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-label transition-colors duration-300",
                  active
                    ? "text-foreground underline decoration-1 underline-offset-8"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          {actions}
          {userEmail && (
            <>
              <span
                className="hidden max-w-40 truncate text-xs text-muted-foreground md:inline"
                title={userEmail}
              >
                {userEmail}
              </span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-label whitespace-nowrap text-muted-foreground transition-colors duration-300 hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
