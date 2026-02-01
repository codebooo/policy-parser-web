"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Users, FileText, Activity, ScrollText, ExternalLink, Database, 
    Trash2, RefreshCw, Brain, Clock, CheckCircle2, XCircle, 
    AlertTriangle, Shield, Search, Loader2, BarChart3,
    Server, Zap
} from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import {
    getAdminStats,
    getAdminCacheList,
    getAdminRecentAnalyses,
    getAdminUsers,
    deleteCacheItem,
    deleteCacheByDomain,
    clearAllCache,
    isAdminUser
} from "../actions";

type TabType = 'overview' | 'cache' | 'users' | 'analyses';

export default function AdminDashboard() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    
    // Stats
    const [stats, setStats] = useState<any>(null);
    
    // Cache
    const [cacheItems, setCacheItems] = useState<any[]>([]);
    const [cacheFilter, setCacheFilter] = useState("");
    const [cacheLoading, setCacheLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    
    // Analyses
    const [analyses, setAnalyses] = useState<any[]>([]);
    const [analysesLoading, setAnalysesLoading] = useState(false);
    
    // Users
    const [users, setUsers] = useState<any[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // Action feedback
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        checkAdminAndLoad();
    }, []);

    const checkAdminAndLoad = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user || user.email !== 'policyparser.admin@gmail.com') {
            router.push('/login?redirect=/admin&message=Admin access required');
            return;
        }
        
        setIsAdmin(true);
        await loadStats();
        setIsLoading(false);
    };

    const loadStats = async () => {
        const result = await getAdminStats();
        if (result.success) {
            setStats(result.stats);
        }
    };

    const loadCache = async () => {
        setCacheLoading(true);
        const result = await getAdminCacheList();
        if (result.success) {
            setCacheItems(result.items || []);
        }
        setCacheLoading(false);
    };

    const loadAnalyses = async () => {
        setAnalysesLoading(true);
        const result = await getAdminRecentAnalyses();
        if (result.success) {
            setAnalyses(result.analyses || []);
        }
        setAnalysesLoading(false);
    };

    const loadUsers = async () => {
        setUsersLoading(true);
        const result = await getAdminUsers();
        if (result.success) {
            setUsers(result.users || []);
        }
        setUsersLoading(false);
    };

    const handleTabChange = async (tab: TabType) => {
        setActiveTab(tab);
        setActionMessage(null);
        
        if (tab === 'cache' && cacheItems.length === 0) {
            await loadCache();
        } else if (tab === 'analyses' && analyses.length === 0) {
            await loadAnalyses();
        } else if (tab === 'users' && users.length === 0) {
            await loadUsers();
        }
    };

    const handleDeleteCacheItem = async (id: string) => {
        if (!confirm("Are you sure you want to delete this cached policy?")) return;
        
        setDeletingId(id);
        const result = await deleteCacheItem(id);
        
        if (result.success) {
            setCacheItems(prev => prev.filter(item => item.id !== id));
            setActionMessage({ type: 'success', text: 'Cache item deleted successfully' });
            loadStats(); // Refresh stats
        } else {
            setActionMessage({ type: 'error', text: result.error || 'Failed to delete' });
        }
        setDeletingId(null);
    };

    const handleDeleteByDomain = async (domain: string) => {
        if (!confirm(`Delete ALL cached policies for ${domain}?`)) return;
        
        const result = await deleteCacheByDomain(domain);
        
        if (result.success) {
            setCacheItems(prev => prev.filter(item => item.domain !== domain));
            setActionMessage({ type: 'success', text: `Deleted ${result.count} items for ${domain}` });
            loadStats();
        } else {
            setActionMessage({ type: 'error', text: result.error || 'Failed to delete' });
        }
    };

    const handleClearAllCache = async () => {
        if (!confirm("⚠️ DANGER: This will delete ALL cached policies!\n\nAre you absolutely sure?")) return;
        if (!confirm("This action cannot be undone. Type 'yes' in the next prompt to confirm.")) return;
        
        const result = await clearAllCache();
        
        if (result.success) {
            setCacheItems([]);
            setActionMessage({ type: 'success', text: `Cleared ${result.count} items from cache` });
            loadStats();
        } else {
            setActionMessage({ type: 'error', text: result.error || 'Failed to clear cache' });
        }
    };

    const filteredCacheItems = cacheItems.filter(item => 
        item.domain.toLowerCase().includes(cacheFilter.toLowerCase()) ||
        item.policy_type.toLowerCase().includes(cacheFilter.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Verifying admin access...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                        <Shield className="h-12 w-12 text-primary relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                        <p className="text-muted-foreground">Manage PolicyParser system</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href="/brain">
                        <Button variant="outline">
                            <Brain className="h-4 w-4 mr-2" />
                            Neural Network
                        </Button>
                    </Link>
                    <Link href="/review">
                        <Button variant="outline">
                            <Server className="h-4 w-4 mr-2" />
                            Background Scraper
                        </Button>
                    </Link>
                    <Link href="/admin/logs">
                        <Button variant="outline">
                            <ScrollText className="h-4 w-4 mr-2" />
                            Deep Logs
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Action Message */}
            {actionMessage && (
                <div className={clsx(
                    "mb-6 p-4 rounded-lg flex items-center gap-3",
                    actionMessage.type === 'success' ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"
                )}>
                    {actionMessage.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    {actionMessage.text}
                    <button onClick={() => setActionMessage(null)} className="ml-auto hover:opacity-70">×</button>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-8 border-b border-white/10 pb-4">
                {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'cache', label: 'Cache Manager', icon: Database },
                    { id: 'analyses', label: 'Analyses', icon: FileText },
                    { id: 'users', label: 'Users', icon: Users }
                ].map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'default' : 'ghost'}
                        onClick={() => handleTabChange(tab.id as TabType)}
                        className="flex items-center gap-2"
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                    </Button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-8">
                    {/* Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                                <Users className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats?.totalUsers || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Total Analyses</CardTitle>
                                <FileText className="h-4 w-4 text-blue-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats?.totalAnalyses || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Cached Policies</CardTitle>
                                <Database className="h-4 w-4 text-purple-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats?.totalCachedPolicies || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/5 border-white/10">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">System Status</CardTitle>
                                <Activity className="h-4 w-4 text-green-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-400">Operational</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Second Row Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card className="bg-blue-500/10 border-blue-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-blue-400 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Queue Pending
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.queuePending || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-500/10 border-green-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Queue Completed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.queueCompleted || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-red-500/10 border-red-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                                    <XCircle className="h-4 w-4" />
                                    Queue Failed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.queueFailed || 0}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-purple-500/10 border-purple-500/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
                                    <Brain className="h-4 w-4" />
                                    Brain Generation
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.brainGeneration || 0}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Actions */}
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Zap className="h-5 w-5 text-yellow-400" />
                                Quick Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4 md:grid-cols-3">
                                <Button variant="outline" onClick={() => handleTabChange('cache')}>
                                    <Database className="h-4 w-4 mr-2" />
                                    Manage Cache
                                </Button>
                                <Link href="/brain" className="w-full">
                                    <Button variant="outline" className="w-full">
                                        <Brain className="h-4 w-4 mr-2" />
                                        Train Neural Network
                                    </Button>
                                </Link>
                                <Link href="/review" className="w-full">
                                    <Button variant="outline" className="w-full">
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Background Scraper
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Cache Manager Tab */}
            {activeTab === 'cache' && (
                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Database className="h-5 w-5" />
                                        Policy Cache Manager
                                    </CardTitle>
                                    <CardDescription>
                                        Manage cached policy analyses. Delete individual items or clear by domain.
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={loadCache} disabled={cacheLoading}>
                                        <RefreshCw className={clsx("h-4 w-4 mr-2", cacheLoading && "animate-spin")} />
                                        Refresh
                                    </Button>
                                    <Button variant="destructive" onClick={handleClearAllCache}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Clear All Cache
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Search/Filter */}
                            <div className="mb-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Filter by domain or policy type..."
                                        value={cacheFilter}
                                        onChange={(e) => setCacheFilter(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {cacheLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : filteredCacheItems.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    {cacheItems.length === 0 ? "No cached policies found" : "No results match your filter"}
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Domain</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Words</TableHead>
                                            <TableHead>Cached At</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCacheItems.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex flex-col">
                                                        <span>{item.domain}</span>
                                                        {item.policy_url && (
                                                            <a 
                                                                href={item.policy_url} 
                                                                target="_blank" 
                                                                rel="noreferrer" 
                                                                className="text-xs text-muted-foreground hover:underline truncate max-w-[200px] flex items-center gap-1"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                                View Policy
                                                            </a>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="capitalize px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                                                        {item.policy_type}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={clsx(
                                                        "font-bold",
                                                        item.score >= 80 ? "text-green-500" :
                                                            item.score >= 60 ? "text-yellow-500" :
                                                                "text-red-500"
                                                    )}>
                                                        {item.score ?? '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{item.word_count?.toLocaleString() ?? '-'}</TableCell>
                                                <TableCell>{new Date(item.analyzed_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => handleDeleteByDomain(item.domain)}
                                                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                                        >
                                                            <AlertTriangle className="h-4 w-4 mr-1" />
                                                            Domain
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => handleDeleteCacheItem(item.id)}
                                                            disabled={deletingId === item.id}
                                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        >
                                                            {deletingId === item.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Analyses Tab */}
            {activeTab === 'analyses' && (
                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Recent Analyses
                                </CardTitle>
                                <Button variant="outline" onClick={loadAnalyses} disabled={analysesLoading}>
                                    <RefreshCw className={clsx("h-4 w-4 mr-2", analysesLoading && "animate-spin")} />
                                    Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {analysesLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : analyses.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No analyses found
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Company</TableHead>
                                            <TableHead>Domain</TableHead>
                                            <TableHead>Score</TableHead>
                                            <TableHead>Discovery Method</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analyses.map((analysis) => (
                                            <TableRow key={analysis.id}>
                                                <TableCell className="font-medium">{analysis.company_name || analysis.domain}</TableCell>
                                                <TableCell>{analysis.domain}</TableCell>
                                                <TableCell>
                                                    <span className={clsx(
                                                        "font-bold",
                                                        analysis.score >= 80 ? "text-green-500" :
                                                            analysis.score >= 60 ? "text-yellow-500" :
                                                                "text-red-500"
                                                    )}>
                                                        {analysis.score}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{analysis.discovery_method || 'Legacy'}</span>
                                                        {analysis.policy_url && (
                                                            <a href={analysis.policy_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline truncate max-w-[200px]">
                                                                {analysis.policy_url}
                                                            </a>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{new Date(analysis.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm">View</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    User Management
                                </CardTitle>
                                <Button variant="outline" onClick={loadUsers} disabled={usersLoading}>
                                    <RefreshCw className={clsx("h-4 w-4 mr-2", usersLoading && "animate-spin")} />
                                    Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {usersLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : users.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    No users found
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Display Name</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Joined</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.email}</TableCell>
                                                <TableCell>{user.display_name || '-'}</TableCell>
                                                <TableCell>
                                                    {user.is_pro ? (
                                                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                                                            PRO
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
                                                            Free
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
