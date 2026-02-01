'use client';

import { createClient } from '@/utils/supabase/client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ArrowLeft, RefreshCw, Search, Download, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface DeepLogEntry {
    id: string;
    session_id: string;
    user_id: string | null;
    timestamp: string;
    phase: string;
    message: string;
    data: any;
    created_at: string;
}

interface LogSession {
    session_id: string;
    entries: DeepLogEntry[];
    expanded: boolean;
    startTime: string;
    endTime: string;
    input?: string;
    phases: string[];
}

// Simple Badge component
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={clsx(
            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white",
            className
        )}>
            {children}
        </span>
    );
}

export default function AdminLogsPage() {
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState<LogSession[]>([]);
    const [filter, setFilter] = useState('');
    const [phaseFilter, setPhaseFilter] = useState('all');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);

    const supabase = createClient();

    const checkAdmin = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || user.email !== 'policyparser.admin@gmail.com') {
            router.push('/');
            return false;
        }
        setIsAdmin(true);
        return true;
    }, [supabase.auth, router]);

    const loadLogs = useCallback(async () => {
        setRefreshing(true);
        try {
            const { data, error } = await supabase
                .from('deep_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) {
                console.error('Error loading logs:', error);
                return;
            }

            // Group logs by session_id
            const sessionMap = new Map<string, DeepLogEntry[]>();
            (data || []).forEach((entry: DeepLogEntry) => {
                const existing = sessionMap.get(entry.session_id) || [];
                existing.push(entry);
                sessionMap.set(entry.session_id, existing);
            });

            // Convert to session objects
            const sessionList: LogSession[] = [];
            sessionMap.forEach((entries, session_id) => {
                // Sort entries by timestamp
                entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                
                // Find input from request_init phase
                const initEntry = entries.find(e => e.phase === 'request_init');
                const input = initEntry?.data?.input || 'Unknown';

                // Get unique phases
                const phases = [...new Set(entries.map(e => e.phase))];

                sessionList.push({
                    session_id,
                    entries,
                    expanded: false,
                    startTime: entries[0]?.timestamp || '',
                    endTime: entries[entries.length - 1]?.timestamp || '',
                    input,
                    phases
                });
            });

            // Sort sessions by most recent first
            sessionList.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

            setSessions(sessionList);
        } catch (err) {
            console.error('Error loading logs:', err);
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [supabase]);

    useEffect(() => {
        checkAdmin().then(isAdmin => {
            if (isAdmin) {
                loadLogs();
            }
        });
    }, [checkAdmin, loadLogs]);

    const toggleSession = (sessionId: string) => {
        setSessions(prev => prev.map(s => 
            s.session_id === sessionId ? { ...s, expanded: !s.expanded } : s
        ));
    };

    const clearAllLogs = async () => {
        if (!confirm('Are you sure you want to delete ALL logs? This cannot be undone.')) return;
        
        const { error } = await supabase.from('deep_logs').delete().neq('id', '');
        if (!error) {
            setSessions([]);
        }
    };

    const deleteSession = async (sessionId: string) => {
        if (!confirm('Delete this session\'s logs?')) return;
        
        const { error } = await supabase.from('deep_logs').delete().eq('session_id', sessionId);
        if (!error) {
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        }
    };

    const exportSession = (session: LogSession) => {
        const data = JSON.stringify(session.entries, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${session.session_id}-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const getPhaseColor = (phase: string): string => {
        const colors: Record<string, string> = {
            'request_init': 'bg-blue-500',
            'target_identification': 'bg-indigo-500',
            'known_company_match': 'bg-green-500',
            'known_company_hit': 'bg-green-500',
            'known_company_miss': 'bg-gray-500',
            'search_engine_google': 'bg-yellow-500',
            'search_engine_bing': 'bg-purple-500',
            'search_engine_duckduckgo': 'bg-orange-500',
            'google_start': 'bg-yellow-600',
            'bing_start': 'bg-purple-600',
            'duckduckgo_start': 'bg-orange-600',
            'consensus_calculation': 'bg-cyan-500',
            'consensus_calc': 'bg-cyan-500',
            'multi_engine_start': 'bg-blue-400',
            'multi_engine_results': 'bg-blue-500',
            'multi_engine_success': 'bg-green-500',
            'multi_engine_fail': 'bg-red-500',
            'multi_engine_complete': 'bg-green-600',
            'domain_resolved': 'bg-emerald-500',
            'strategy_start': 'bg-blue-600',
            'strategy_result': 'bg-blue-700',
            'strategy_complete': 'bg-blue-800',
            'candidate_found': 'bg-green-600',
            'url_validation': 'bg-amber-500',
            'content_extraction': 'bg-violet-500',
            'ai_analysis_start': 'bg-pink-500',
            'ai_analysis_complete': 'bg-pink-600',
            'http_request': 'bg-slate-500',
            'http_response': 'bg-slate-600',
            'error': 'bg-red-500',
            'complete': 'bg-green-700',
            'guess_start': 'bg-gray-600',
            'guess_try': 'bg-gray-500',
            'guess_success': 'bg-green-500',
            'fallback_guess': 'bg-yellow-600',
        };
        return colors[phase] || 'bg-gray-500';
    };

    const filteredSessions = sessions.filter(session => {
        const matchesText = !filter || 
            session.input?.toLowerCase().includes(filter.toLowerCase()) ||
            session.session_id.toLowerCase().includes(filter.toLowerCase());
        
        const matchesPhase = phaseFilter === 'all' || session.phases.includes(phaseFilter);
        
        return matchesText && matchesPhase;
    });

    const allPhases = [...new Set(sessions.flatMap(s => s.phases))].sort();

    if (loading) {
        return (
            <div className="container mx-auto py-12 px-4">
                <div className="animate-pulse">
                    <div className="h-8 bg-white/10 rounded w-1/4 mb-8"></div>
                    <div className="h-64 bg-white/10 rounded"></div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="container mx-auto py-12 px-4 max-w-7xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">Deep Logs</h1>
                    <span className="px-2 py-1 rounded border border-white/20 text-xs text-muted-foreground">
                        {sessions.length} sessions
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => loadLogs()}
                        disabled={refreshing}
                    >
                        <RefreshCw className={clsx("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={clearAllLogs}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-white/5 border-white/10 mb-6">
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by input or session ID..."
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="pl-10 bg-white/5 border-white/10"
                            />
                        </div>
                        <select
                            value={phaseFilter}
                            onChange={(e) => setPhaseFilter(e.target.value)}
                            className="w-[200px] px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="all">All Phases</option>
                            {allPhases.map(phase => (
                                <option key={phase} value={phase}>{phase}</option>
                            ))}
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* Sessions List */}
            <div className="space-y-4">
                {filteredSessions.length === 0 ? (
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">
                                {sessions.length === 0 
                                    ? "No logs recorded yet. Logs are created when an admin user runs an analysis."
                                    : "No sessions match your filters."
                                }
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    filteredSessions.map(session => (
                        <Card key={session.session_id} className="bg-white/5 border-white/10">
                            <CardHeader 
                                className="cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => toggleSession(session.session_id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {session.expanded ? (
                                            <ChevronDown className="h-5 w-5" />
                                        ) : (
                                            <ChevronRight className="h-5 w-5" />
                                        )}
                                        <div>
                                            <CardTitle className="text-lg">
                                                {session.input}
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Session: {session.session_id.slice(0, 8)}... | 
                                                {' '}{new Date(session.startTime).toLocaleString()} |
                                                {' '}{session.entries.length} entries
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => exportSession(session)}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteSession(session.session_id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-400" />
                                        </Button>
                                    </div>
                                </div>
                                {/* Phase badges */}
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {session.phases.slice(0, 8).map(phase => (
                                        <Badge 
                                            key={phase} 
                                            className={getPhaseColor(phase)}
                                        >
                                            {phase}
                                        </Badge>
                                    ))}
                                    {session.phases.length > 8 && (
                                        <Badge className="bg-gray-600">
                                            +{session.phases.length - 8} more
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>

                            {session.expanded && (
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[180px]">Time</TableHead>
                                                <TableHead className="w-[180px]">Phase</TableHead>
                                                <TableHead>Message</TableHead>
                                                <TableHead className="w-[100px]">Data</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {session.entries.map((entry, idx) => (
                                                <TableRow key={entry.id || idx}>
                                                    <TableCell className="font-mono text-xs">
                                                        {new Date(entry.timestamp).toLocaleTimeString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={getPhaseColor(entry.phase)}>
                                                            {entry.phase}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {entry.message}
                                                    </TableCell>
                                                    <TableCell>
                                                        {entry.data && Object.keys(entry.data).length > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedSession(selectedSession === `${session.session_id}-${idx}` ? null : `${session.session_id}-${idx}`);
                                                                }}
                                                            >
                                                                View
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    {/* Data viewer */}
                                    {selectedSession && session.entries.some((_, idx) => selectedSession === `${session.session_id}-${idx}`) && (
                                        <div className="mt-4 p-4 bg-black/30 rounded-lg">
                                            <pre className="text-xs overflow-auto max-h-[400px] text-green-400">
                                                {JSON.stringify(
                                                    session.entries[parseInt(selectedSession.split('-').pop() || '0')].data,
                                                    null, 
                                                    2
                                                )}
                                            </pre>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
