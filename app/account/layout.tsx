"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, LogOut, Shield } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await signOutAction();
    };

    const navItems = [
        { href: "/account", label: "Dashboard", icon: LayoutDashboard },
        { href: "/account/settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <aside className="w-full md:w-64 shrink-0 space-y-8">
                    <div className="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">My Account</h2>
                                <p className="text-xs text-muted-foreground">Manage your preferences</p>
                            </div>
                        </div>

                        <nav className="space-y-2">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <Link key={item.href} href={item.href}>
                                        <button
                                            className={clsx(
                                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow-md"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {item.label}
                                        </button>
                                    </Link>
                                );
                            })}
                        </nav>

                        <div className="mt-6 pt-6 border-t border-white/10">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Log Out
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
