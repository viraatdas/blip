import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const navItems = [
  { href: "/", label: "Executions" },
  { href: "/api-keys", label: "API Keys" },
  { href: "/usage", label: "Usage" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="mb-8 px-5 pt-6">
          <Link href="/">
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              blip
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Claude Code as an API
            </p>
          </Link>
        </div>
        <nav className="flex-1 px-3">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <Link
              href="/environments"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Environments
            </Link>
          </div>
        </nav>
        <div className="border-t border-gray-200 pt-4 mt-4 px-5 pb-4">
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
