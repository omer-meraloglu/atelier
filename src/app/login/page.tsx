import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      {/* Editorial statement panel */}
      <div className="hidden flex-col justify-between border-r hairline bg-ink p-12 text-bone lg:flex">
        <Link href="/" className="font-display text-2xl tracking-tight">
          Atelier
        </Link>
        <p className="font-display max-w-md text-5xl leading-[1.1] tracking-tight">
          The fitting room,
          <br />
          <em>reimagined.</em>
        </p>
        <p className="text-label text-bone/60">
          Virtual try-on studio — private preview
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-16 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="font-display text-2xl tracking-tight lg:hidden"
          >
            Atelier
          </Link>
          <h1 className="font-display mt-10 text-3xl tracking-tight lg:mt-0">
            Sign in
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            No password. We&apos;ll email you a link.
          </p>
          <div className="mt-10">
            <LoginForm serverError={error} />
          </div>
        </div>
      </div>
    </main>
  );
}
