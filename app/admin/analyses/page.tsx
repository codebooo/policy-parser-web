"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Loader2,
    ArrowLeft,
    CheckCircle,
    XCircle,
    MinusCircle,
    ThumbsUp,
    ThumbsDown,
    Search,
    ExternalLink,
    RefreshCw,
    BarChart3
} from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";
import { isAdminUser } from "@/app/actions";
import { getAnalysisLogs, getAnalysisStats, AnalysisLogEntry } from "@/app/lib/analysisStore";

export default function AdminAnalysesPage() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AnalysisLogEntry[]>([]);
    const [stats, setStats] = useState<{
        total: number;
        successful: number;
        failed: number;
        positiveFeedback: number;
        negativeFeedback: number;
        avgScore: number | null;
    } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "failed" | "feedback">("all");

    useEffect(() => {
        checkAdminAndLoad();
    }, []);

    const checkAdminAndLoad = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            return;
        }

        const admin = await isAdminUser();
        if (!admin) {
            router.push('/');
            return;
        }

        setIsAdmin(true);
        await loadData();
        setLoading(false);
    };

    const loadData = async () => {
        const options: any = { limit: 200 };

        if (filter === "failed") {
            options.onlyFailures = true;
        } else if (filter === "feedback") {
            options.onlyWithFeedback = true;
        }

        if (searchQuery) {
            options.domain = searchQuery;
        }

        const [logsData, statsData] = await Promise.all([
            getAnalysisLogs(options),
            getAnalysisStats()
        ]);

        setLogs(logsData);
        setStats(statsData);
    };

    const handleSearch = () => {
        loadData();
    };

    const handleFilterChange = (newFilter: typeof filter) => {
        setFilter(newFilter);
    };

    useEffect(() => {
        if (!loading) {
            loadData();
        }
    }, [filter]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Admin
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Analysis Logs</h1>
                        <p className="text-sm text-muted-foreground">
                            View all analyses with success/failure status and user feedback
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={loadData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                            <div className="text-xs text-muted-foreground">Total</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-500/10 border-green-500/30">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-green-400">{stats.successful}</div>
                            <div className="text-xs text-muted-foreground">Successful</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-500/10 border-red-500/30">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
                            <div className="text-xs text-muted-foreground">Failed</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-cyan-500/10 border-cyan-500/30">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-cyan-400">{stats.positiveFeedback}</div>
                            <div className="text-xs text-muted-foreground">👍 Positive</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-orange-500/10 border-orange-500/30">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-orange-400">{stats.negativeFeedback}</div>
                            <div className="text-xs text-muted-foreground">👎 Negative</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-purple-500/10 border-purple-500/30">
                        <CardContent className="p-4 text-center">
                            <div className="text-2xl font-bold text-purple-400">
                                {stats.avgScore !== null ? stats.avgScore : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">Avg Score</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex gap-2">
                    <Button
                        variant={filter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleFilterChange("all")}
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === "failed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleFilterChange("failed")}
                        className={filter === "failed" ? "bg-red-500 hover:bg-red-600" : ""}
                    >
                        <XCircle className="h-4 w-4 mr-1" />
                        Failed Only
                    </Button>
                    <Button
                        variant={filter === "feedback" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleFilterChange("feedback")}
                    >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        With Feedback
                    </Button>
                </div>
                <div className="flex gap-2 flex-1">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by domain..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="pl-9 bg-white/5 border-white/10"
                        />
                    </div>
                    <Button onClick={handleSearch}>Search</Button>
                </div>
            </div>

            {/* Logs Table */}
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-white/10 text-left">
                                    <th className="p-4 font-medium text-muted-foreground">Status</th>
                                    <th className="p-4 font-medium text-muted-foreground">Domain</th>
                                    <th className="p-4 font-medium text-muted-foreground hidden md:table-cell">URL</th>
                                    <th className="p-4 font-medium text-muted-foreground">Score</th>
                                    <th className="p-4 font-medium text-muted-foreground">Feedback</th>
                                    <th className="p-4 font-medium text-muted-foreground hidden lg:table-cell">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                            No analyses found. Try running some analyses first.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className={clsx(
                                                "border-b border-white/5 hover:bg-white/5 transition-colors",
                                                !log.success && "bg-red-500/5",
                                                log.feedbackType === 'positive' && "bg-green-500/5",
                                                log.feedbackType === 'negative' && "bg-orange-500/5"
                                            )}
                                        >
                                            <td className="p-4">
                                                {log.success ? (
                                                    <CheckCircle className="h-5 w-5 text-green-400" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-400" />
                                                )}
                                            </td>
                                            <td className="p-4 font-medium">{log.domain}</td>
                                            <td className="p-4 hidden md:table-cell">
                                                {log.url ? (
                                                    <a
                                                        href={log.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate"
                                                    >
                                                        {new URL(log.url).pathname}
                                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                                    </a>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {log.score !== undefined ? (
                                                    <span className={clsx(
                                                        "px-2 py-1 rounded text-xs font-bold",
                                                        log.score >= 80 ? "bg-green-500/20 text-green-400" :
                                                            log.score >= 60 ? "bg-yellow-500/20 text-yellow-400" :
                                                                "bg-red-500/20 text-red-400"
                                                    )}>
                                                        {log.score}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {log.feedbackType === 'positive' ? (
                                                    <ThumbsUp className="h-5 w-5 text-green-400" />
                                                ) : log.feedbackType === 'negative' ? (
                                                    <ThumbsDown className="h-5 w-5 text-orange-400" />
                                                ) : (
                                                    <MinusCircle className="h-5 w-5 text-muted-foreground/30" />
                                                )}
                                            </td>
                                            <td className="p-4 hidden lg:table-cell text-muted-foreground text-xs">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
