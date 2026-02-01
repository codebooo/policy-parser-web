"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { createClient } from "@/utils/supabase/client"
import { checkProStatus } from "../checkProStatus"
import { getTrackedPolicies, untrackPolicy, checkTrackedPoliciesForUpdates, checkSinglePolicyForUpdates, markChangesAsViewed, TrackedPolicy, getNotificationsCount } from "../trackingActions"
import { Loader2, Shield, Zap, Trash2, RefreshCw, CheckCircle2, AlertCircle, Bell, Eye, TrendingUp, TrendingDown, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { clsx } from "clsx"
import PolicyDiffView from "@/components/PolicyDiffView"

export default function AccountPage() {
    const [user, setUser] = useState<any>(null)
    const [isPro, setIsPro] = useState(false)
    const [loading, setLoading] = useState(true)
    const [trackedPolicies, setTrackedPolicies] = useState<TrackedPolicy[]>([])
    const [checkingUpdates, setCheckingUpdates] = useState(false)
    const [checkingSingle, setCheckingSingle] = useState<string | null>(null)
    const [notificationCount, setNotificationCount] = useState(0)
    const [selectedDiffPolicy, setSelectedDiffPolicy] = useState<TrackedPolicy | null>(null)
    const router = useRouter()

    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/login')
                return
            }

            setUser(user)

            const status = await checkProStatus()
            setIsPro(status.isPro)

            const policies = await getTrackedPolicies()
            setTrackedPolicies(policies)

            const count = await getNotificationsCount()
            setNotificationCount(count)

            setLoading(false)
        }
        init()
    }, [router])

    const handleUntrack = async (domain: string) => {
        if (confirm(`Are you sure you want to stop tracking ${domain}?`)) {
            await untrackPolicy(domain)
            setTrackedPolicies(prev => prev.filter(p => p.domain !== domain))
        }
    }

    const handleCheckSinglePolicy = async (domain: string) => {
        setCheckingSingle(domain)
        try {
            const result = await checkSinglePolicyForUpdates(domain)
            if (result.success) {
                // Refresh the tracked policies list
                const policies = await getTrackedPolicies()
                setTrackedPolicies(policies)
                
                const count = await getNotificationsCount()
                setNotificationCount(count)

                if (result.hasChanges) {
                    alert(`Changes detected for ${domain}! Click "View Changes" to see the diff.`)
                } else {
                    alert(`No changes detected for ${domain}.`)
                }
            } else {
                alert(result.error || "Failed to check for updates.")
            }
        } catch (e) {
            console.error(e)
            alert("An error occurred while checking for updates.")
        } finally {
            setCheckingSingle(null)
        }
    }

    const handleCheckAllUpdates = async () => {
        setCheckingUpdates(true)
        try {
            const result = await checkTrackedPoliciesForUpdates()
            if (result.success) {
                // Refresh the tracked policies list
                const policies = await getTrackedPolicies()
                setTrackedPolicies(policies)
                
                const count = await getNotificationsCount()
                setNotificationCount(count)

                const changesCount = result.updates?.filter(u => u.hasChanges).length || 0
                if (changesCount > 0) {
                    alert(`Found changes in ${changesCount} policy/policies! Check the notifications below.`)
                } else {
                    alert("No changes found in any tracked policies.")
                }
            } else {
                alert(result.error || "Failed to check for updates.")
            }
        } catch (e) {
            console.error(e)
            alert("An error occurred while checking for updates.")
        } finally {
            setCheckingUpdates(false)
        }
    }

    const handleViewDiff = (policy: TrackedPolicy) => {
        setSelectedDiffPolicy(policy)
    }

    const handleMarkAsViewed = async (domain: string) => {
        await markChangesAsViewed(domain)
        setTrackedPolicies(prev => prev.map(p => 
            p.domain === domain ? { ...p, has_changes: false, previous_analysis: null } : p
        ))
        const count = await getNotificationsCount()
        setNotificationCount(count)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const policiesWithChanges = trackedPolicies.filter(p => p.has_changes)
    const policiesWithoutChanges = trackedPolicies.filter(p => !p.has_changes)

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Diff View Modal */}
            {selectedDiffPolicy && selectedDiffPolicy.previous_analysis && selectedDiffPolicy.last_analysis && (
                <PolicyDiffView
                    domain={selectedDiffPolicy.domain}
                    oldAnalysis={selectedDiffPolicy.previous_analysis}
                    newAnalysis={selectedDiffPolicy.last_analysis}
                    onClose={() => setSelectedDiffPolicy(null)}
                    onMarkAsViewed={() => handleMarkAsViewed(selectedDiffPolicy.domain)}
                />
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
                </div>
                <Link href="/analyze">
                    <Button variant="outline">New Analysis</Button>
                </Link>
            </div>

            {/* Profile Card */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">{user?.email}</CardTitle>
                        <CardDescription>Member since {new Date(user?.created_at).toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        {/* Notification Badge */}
                        {notificationCount > 0 && (
                            <div className="relative">
                                <Bell className="h-6 w-6 text-amber-400" />
                                <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                                    {notificationCount}
                                </span>
                            </div>
                        )}
                        
                        {isPro ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400/20 to-orange-500/20 border border-amber-400/30 rounded-full">
                                <Zap className="h-4 w-4 text-amber-400" />
                                <span className="text-sm font-bold text-amber-400">PRO MEMBER</span>
                            </div>
                        ) : (
                            <Link href="/plans">
                                <Button size="sm" className="bg-gradient-to-r from-primary to-cyan-600 hover:opacity-90">Upgrade to Pro</Button>
                            </Link>
                        )}
                    </div>
                </CardHeader>
            </Card>

            {/* Policy Changes Notifications */}
            {policiesWithChanges.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Bell className="h-6 w-6 text-amber-400" />
                        Policy Updates
                        <span className="text-sm font-normal text-muted-foreground">({policiesWithChanges.length} changes)</span>
                    </h2>

                    <div className="grid gap-4">
                        {policiesWithChanges.map((policy) => {
                            const scoreDiff = policy.last_analysis?.score && policy.previous_analysis?.score
                                ? policy.last_analysis.score - policy.previous_analysis.score
                                : 0;
                            
                            return (
                                <Card key={policy.id} className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 animate-in fade-in slide-in-from-top-2">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                                                    {policy.domain.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-foreground flex items-center gap-2">
                                                        {policy.domain}
                                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">UPDATED</span>
                                                    </h3>
                                                    <div className="flex items-center gap-3 text-sm">
                                                        {scoreDiff !== 0 && (
                                                            <span className={clsx(
                                                                "flex items-center gap-1",
                                                                scoreDiff > 0 ? "text-green-400" : "text-red-400"
                                                            )}>
                                                                {scoreDiff > 0 
                                                                    ? <TrendingUp className="h-3 w-3" /> 
                                                                    : <TrendingDown className="h-3 w-3" />
                                                                }
                                                                Score {scoreDiff > 0 ? '+' : ''}{scoreDiff} ({policy.previous_analysis?.score} → {policy.last_analysis?.score})
                                                            </span>
                                                        )}
                                                        <span className="text-muted-foreground">
                                                            Detected: {new Date(policy.last_checked).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => handleViewDiff(policy)}
                                                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Changes
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleMarkAsViewed(policy.domain)}
                                                    className="text-muted-foreground hover:text-foreground"
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                                    Dismiss
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tracked Policies */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-foreground">Tracked Policies</h2>
                    <Button
                        onClick={handleCheckAllUpdates}
                        disabled={checkingUpdates || trackedPolicies.length === 0}
                        variant="outline"
                    >
                        {checkingUpdates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Check All for Updates
                    </Button>
                </div>

                {trackedPolicies.length === 0 ? (
                    <Card className="bg-background/40 border-dashed border-white/10">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                            <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
                            <p className="text-muted-foreground">You are not tracking any policies yet.</p>
                            <Link href="/analyze">
                                <Button variant="ghost">Analyze a policy to start tracking</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {policiesWithoutChanges.map((policy) => (
                            <Card key={policy.id} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {policy.domain.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-foreground flex items-center gap-2">
                                                {policy.domain}
                                                {policy.last_analysis?.score !== undefined && (
                                                    <span className={clsx(
                                                        "px-2 py-0.5 text-[10px] font-bold rounded",
                                                        policy.last_analysis.score >= 80 ? "bg-green-500/20 text-green-400" :
                                                            policy.last_analysis.score >= 60 ? "bg-yellow-500/20 text-yellow-400" :
                                                                "bg-red-500/20 text-red-400"
                                                    )}>
                                                        Score: {policy.last_analysis.score}
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                Last checked: {new Date(policy.last_checked).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {policy.policy_url && (
                                            <a href={policy.policy_url} target="_blank" rel="noopener noreferrer">
                                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </a>
                                        )}
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleCheckSinglePolicy(policy.domain)}
                                            disabled={checkingSingle === policy.domain}
                                            className="text-muted-foreground hover:text-primary"
                                        >
                                            {checkingSingle === policy.domain 
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <RefreshCw className="h-4 w-4" />
                                            }
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleUntrack(policy.domain)} 
                                            className="text-muted-foreground hover:text-red-400"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Pro Feature Info */}
            {!isPro && trackedPolicies.length > 0 && (
                <Card className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border-amber-500/20">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Zap className="h-8 w-8 text-amber-400" />
                            <div>
                                <h3 className="font-semibold text-foreground">Upgrade to Pro</h3>
                                <p className="text-sm text-muted-foreground">Get automatic policy monitoring, email notifications, and unlimited tracking.</p>
                            </div>
                        </div>
                        <Link href="/plans">
                            <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold">
                                Upgrade Now
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
