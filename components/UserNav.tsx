"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { User, LogOut, Settings, Bell, LayoutDashboard, CheckCircle2, AlertTriangle, Info, X, Shield } from "lucide-react";
import { Button } from "./ui/button";

interface Notification {
    id: string;
    type: 'info' | 'warning' | 'success';
    title: string;
    message: string;
    time: string;
    read: boolean;
}

// Mock notifications - in production, fetch from Supabase
const mockNotifications: Notification[] = [
    {
        id: '1',
        type: 'success',
        title: 'Welcome to PolicyParser!',
        message: 'Start by analyzing your first privacy policy.',
        time: '2 hours ago',
        read: false,
    },
    {
        id: '2',
        type: 'info',
        title: 'New Feature: Community Scores',
        message: 'You can now rate policies and see community ratings.',
        time: '1 day ago',
        read: false,
    },
    {
        id: '3',
        type: 'warning',
        title: 'Policy Update Detected',
        message: 'Google has updated their privacy policy.',
        time: '3 days ago',
        read: true,
    },
];

export function UserNav({ user }: { user: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const supabase = createClient();

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.refresh();
        router.push("/");
    };

    const markAsRead = (id: string) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => 
            prev.map(n => ({ ...n, read: true }))
        );
    };

    const clearNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-400" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-orange-400" />;
            default:
                return <Info className="h-4 w-4 text-blue-400" />;
        }
    };

    return (
        <div className="flex items-center gap-4">
            {/* Notification Button & Popup */}
            <div className="relative" ref={notificationRef}>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="relative text-muted-foreground hover:text-foreground"
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                            {unreadCount}
                        </span>
                    )}
                </Button>

                {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-[#0f172a] border border-white/10 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                            <h3 className="font-semibold text-foreground">Notifications</h3>
                            {unreadCount > 0 && (
                                <button 
                                    onClick={markAllAsRead}
                                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.map((notification) => (
                                    <div 
                                        key={notification.id}
                                        className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                                            !notification.read ? 'bg-primary/5' : ''
                                        }`}
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-medium text-foreground truncate">
                                                        {notification.title}
                                                    </p>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            clearNotification(notification.id);
                                                        }}
                                                        className="text-muted-foreground hover:text-foreground p-1"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    {notification.time}
                                                </p>
                                            </div>
                                            {!notification.read && (
                                                <div className="h-2 w-2 bg-primary rounded-full shrink-0 mt-1.5"></div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center">
                                    <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                                    <p className="text-sm text-muted-foreground">No notifications</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="px-4 py-2 border-t border-white/5">
                                <Link href="/account?tab=notifications">
                                    <button className="w-full text-center text-xs text-primary hover:text-primary/80 transition-colors py-1">
                                        View all notifications
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 focus:outline-none group"
                >
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent p-[1px]">
                        <div className="h-full w-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                            {user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                            ) : (
                                <span className="font-bold text-primary text-sm">
                                    {user.email?.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                    </div>
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-[#0f172a] border border-white/10 rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="px-4 py-2 border-b border-white/5">
                            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
                            <p className="text-xs text-muted-foreground">Free Plan</p>
                        </div>

                        <div className="py-1">
                            <Link href="/account">
                                <button className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center gap-2 transition-colors">
                                    <LayoutDashboard className="h-4 w-4" />
                                    Dashboard
                                </button>
                            </Link>
                            <Link href="/account">
                                <button className="w-full text-left px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 flex items-center gap-2 transition-colors">
                                    <Settings className="h-4 w-4" />
                                    Settings
                                </button>
                            </Link>
                            {user.email === 'policyparser.admin@gmail.com' && (
                                <Link href="/admin">
                                    <button className="w-full text-left px-4 py-2 text-sm text-primary hover:text-primary/80 hover:bg-primary/10 flex items-center gap-2 transition-colors">
                                        <Shield className="h-4 w-4" />
                                        Admin Dashboard
                                    </button>
                                </Link>
                            )}
                        </div>

                        <div className="border-t border-white/5 py-1">
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                Log out
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
