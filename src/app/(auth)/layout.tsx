import Link from "next/link";
import { Search } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Simple header for auth pages */}
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Search className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Quest-Finder</span>
          </Link>
        </div>
      </header>

      {/* Auth content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>
    </div>
  );
}
