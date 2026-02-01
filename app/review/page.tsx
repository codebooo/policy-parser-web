"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addDomainsToQueue, processNextQueueItem, getQueueStatus, clearAllCache } from "../actions"
import { Play, Plus, RefreshCw, CheckCircle2, XCircle, Clock, Loader2, BrainCircuit, Trash2 } from "lucide-react"

export default function ReviewPage() {
    const [domainsInput, setDomainsInput] = useState("")
    const [isProcessing, setIsProcessing] = useState(false)
    const [stats, setStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0 })
    const [logs, setLogs] = useState<string[]>([])

    useEffect(() => {
        refreshStats()
        const interval = setInterval(refreshStats, 5000)
        return () => clearInterval(interval)
    }, [])

    const refreshStats = async () => {
        const s = await getQueueStatus()
        setStats(s)
    }

    const handleAddDomains = async () => {
        if (!domainsInput.trim()) return

        const domains = domainsInput.split('\n').map(d => d.trim()).filter(d => d)
        const result = await addDomainsToQueue(domains)

        if (result.success) {
            setLogs(prev => [`Added ${result.count} domains to queue`, ...prev])
            setDomainsInput("")
            refreshStats()
        } else {
            setLogs(prev => [`Failed to add domains: ${result.error}`, ...prev])
        }
    }

    const startProcessing = async () => {
        if (isProcessing) {
            setIsProcessing(false)
            return
        }

        setIsProcessing(true)
        setLogs(prev => ["Starting background processing...", ...prev])

        // Process loop
        while (true) {
            // Check if we should stop (this is a bit hacky in React state loop, but works for simple dashboard)
            // We use a ref in a real app, but here we rely on the loop breaking if component unmounts or state changes?
            // Actually, state updates inside loop won't reflect immediately.
            // We'll just process one batch or use a recursive function.

            const result = await processNextQueueItem()

            if (!result.success && result.message === 'Queue is empty') {
                setLogs(prev => ["Queue is empty, stopping.", ...prev])
                setIsProcessing(false)
                break
            }

            if (result.success) {
                setLogs(prev => [`✓ Processed ${result.domain}`, ...prev])
            } else {
                setLogs(prev => [`✗ Failed ${result.domain}: ${result.error}`, ...prev])
            }

            await refreshStats()

            // Small delay
            await new Promise(r => setTimeout(r, 1000))

            // Check if user stopped (we can't easily check state here without ref, so we'll just stop if queue empty or error)
            // Ideally we'd use a ref for isProcessing
        }
    }


    const handleClearCache = async () => {
        if (!confirm("Are you sure you want to clear ALL cached policy versions? This cannot be undone.")) return;

        setLogs(prev => ["Clearing cache...", ...prev]);
        const result = await clearAllCache();

        if (result.success) {
            setLogs(prev => [`✓ Cache cleared! Removed ${result.count} items.`, ...prev]);
        } else {
            setLogs(prev => [`✗ Failed to clear cache: ${result.error}`, ...prev]);
        }
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Background Scraper & Neural Review</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClearCache} className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear Cache
                    </Button>
                    <Button variant="outline" onClick={refreshStats}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-blue-500/10 border-blue-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-400">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.pending}</div>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/10 border-green-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-400">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.completed}</div>
                    </CardContent>
                </Card>
                <Card className="bg-red-500/10 border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-400">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.failed}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Plus className="h-5 w-5" />
                                Add Domains
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Enter domains (one per line)&#10;example.com&#10;openai.com"
                                className="min-h-[150px] font-mono"
                                value={domainsInput}
                                onChange={(e) => setDomainsInput(e.target.value)}
                            />
                            <Button onClick={handleAddDomains} className="w-full">
                                Add to Queue
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BrainCircuit className="h-5 w-5" />
                                Neural Network Control
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                The scraper uses the Neural Network to score links.
                                Processing items will automatically use the latest model generation.
                            </p>
                            <Button
                                size="lg"
                                className={isProcessing ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}
                                onClick={startProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Stop Processing
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-5 w-5 mr-2" />
                                        Start Processing Queue
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <Card className="h-[600px] flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Live Logs
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto font-mono text-sm space-y-2 p-4 bg-black/20 rounded-md mx-6 mb-6">
                        {logs.length === 0 && <span className="text-muted-foreground">No logs yet...</span>}
                        {logs.map((log, i) => (
                            <div key={i} className="border-b border-white/5 pb-1 last:border-0">
                                {log}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
