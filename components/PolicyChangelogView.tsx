'use client'

import { useState } from 'react'
import {
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronDown,
    ChevronUp,
    Calendar,
    Clock,
    Shield,
    AlertCircle,
    CheckCircle2,
    X,
    ArrowRight,
    FileText
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ChangelogItem {
    type: 'WORSE' | 'BETTER' | 'NEUTRAL'
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    category: string
    title: string
    description: string
    old_text?: string
    new_text?: string
    user_impact: string
}

interface ChangelogData {
    summary: string
    overall_verdict: 'SIGNIFICANTLY_WORSE' | 'SOMEWHAT_WORSE' | 'MINIMAL_CHANGE' | 'SOMEWHAT_BETTER' | 'SIGNIFICANTLY_BETTER'
    changes: ChangelogItem[]
    key_concerns: string[]
    positive_changes: string[]
    action_items: string[]
}

interface PolicyChangelogViewProps {
    domain: string
    oldScore: number
    newScore: number
    detectedAt: string
    changelog: ChangelogData
    onClose?: () => void
}

export default function PolicyChangelogView({
    domain,
    oldScore,
    newScore,
    detectedAt,
    changelog,
    onClose
}: PolicyChangelogViewProps) {
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
    const [filterType, setFilterType] = useState<'ALL' | 'WORSE' | 'BETTER' | 'NEUTRAL'>('ALL')
    const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')

    const scoreDiff = newScore - oldScore
    
    const toggleItem = (index: number) => {
        setExpandedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(index)) {
                newSet.delete(index)
            } else {
                newSet.add(index)
            }
            return newSet
        })
    }

    const getVerdictDisplay = (verdict: string) => {
        switch (verdict) {
            case 'SIGNIFICANTLY_WORSE': 
                return { text: 'Significantly Worse', color: 'text-red-500', icon: <TrendingDown className="h-5 w-5" /> }
            case 'SOMEWHAT_WORSE': 
                return { text: 'Somewhat Worse', color: 'text-orange-500', icon: <TrendingDown className="h-5 w-5" /> }
            case 'MINIMAL_CHANGE': 
                return { text: 'Minimal Changes', color: 'text-yellow-400', icon: <Minus className="h-5 w-5" /> }
            case 'SOMEWHAT_BETTER': 
                return { text: 'Somewhat Better', color: 'text-green-400', icon: <TrendingUp className="h-5 w-5" /> }
            case 'SIGNIFICANTLY_BETTER': 
                return { text: 'Significantly Better', color: 'text-green-500', icon: <TrendingUp className="h-5 w-5" /> }
            default: 
                return { text: 'Unknown', color: 'text-muted-foreground', icon: <Minus className="h-5 w-5" /> }
        }
    }

    const getSeverityConfig = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500', emoji: '🔴' }
            case 'HIGH': return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-500', emoji: '🟠' }
            case 'MEDIUM': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', emoji: '🟡' }
            case 'LOW': return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', emoji: '🔵' }
            default: return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-muted-foreground', emoji: '⚪' }
        }
    }

    const getTypeConfig = (type: string) => {
        switch (type) {
            case 'WORSE': return { bg: 'bg-red-500/10', text: 'text-red-400', icon: <TrendingDown className="h-4 w-4" /> }
            case 'BETTER': return { bg: 'bg-green-500/10', text: 'text-green-400', icon: <TrendingUp className="h-4 w-4" /> }
            case 'NEUTRAL': return { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: <Minus className="h-4 w-4" /> }
            default: return { bg: 'bg-white/5', text: 'text-muted-foreground', icon: <Minus className="h-4 w-4" /> }
        }
    }

    const verdict = getVerdictDisplay(changelog.overall_verdict)

    // Filter changes
    const filteredChanges = changelog.changes.filter(change => {
        if (filterType !== 'ALL' && change.type !== filterType) return false
        if (filterSeverity !== 'ALL' && change.severity !== filterSeverity) return false
        return true
    })

    // Count by type
    const worseCout = changelog.changes.filter(c => c.type === 'WORSE').length
    const betterCount = changelog.changes.filter(c => c.type === 'BETTER').length
    const neutralCount = changelog.changes.filter(c => c.type === 'NEUTRAL').length

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-background border border-white/10 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            changelog.overall_verdict.includes('WORSE') ? "bg-red-500/20" :
                            changelog.overall_verdict.includes('BETTER') ? "bg-green-500/20" :
                            "bg-yellow-500/20"
                        )}>
                            <FileText className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Policy Changelog</h3>
                            <p className="text-sm text-muted-foreground">{domain}</p>
                        </div>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Score & Verdict Card */}
                    <Card className={cn(
                        "border-2",
                        changelog.overall_verdict.includes('WORSE') ? "bg-red-500/5 border-red-500/20" :
                        changelog.overall_verdict.includes('BETTER') ? "bg-green-500/5 border-green-500/20" :
                        "bg-yellow-500/5 border-yellow-500/20"
                    )}>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                {/* Score comparison */}
                                <div className="flex items-center gap-4">
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground mb-1">Before</p>
                                        <span className={cn(
                                            "text-3xl font-bold",
                                            oldScore >= 70 ? "text-green-400" :
                                            oldScore >= 50 ? "text-yellow-400" :
                                            "text-red-500"
                                        )}>
                                            {oldScore}
                                        </span>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                    <div className="text-center">
                                        <p className="text-xs text-muted-foreground mb-1">After</p>
                                        <span className={cn(
                                            "text-3xl font-bold",
                                            newScore >= 70 ? "text-green-400" :
                                            newScore >= 50 ? "text-yellow-400" :
                                            "text-red-500"
                                        )}>
                                            {newScore}
                                        </span>
                                    </div>
                                    {scoreDiff !== 0 && (
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1",
                                            scoreDiff > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                        )}>
                                            {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                                            {scoreDiff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                                        </div>
                                    )}
                                </div>

                                {/* Verdict */}
                                <div className={cn("flex items-center gap-2", verdict.color)}>
                                    {verdict.icon}
                                    <span className="font-semibold">{verdict.text}</span>
                                </div>
                            </div>

                            {/* Summary */}
                            <p className="text-sm text-muted-foreground">
                                {changelog.summary}
                            </p>

                            {/* Date */}
                            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Detected: {new Date(detectedAt).toLocaleDateString()}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Key Concerns (if any WORSE changes) */}
                    {changelog.key_concerns.length > 0 && (
                        <Card className="bg-red-500/5 border-red-500/20">
                            <CardHeader className="py-3">
                                <CardTitle className="text-base flex items-center gap-2 text-red-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    Key Concerns
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4">
                                <ul className="space-y-2">
                                    {changelog.key_concerns.map((concern, i) => (
                                        <li key={i} className="text-sm flex items-start gap-2">
                                            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                                            {concern}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Positive Changes (if any) */}
                    {changelog.positive_changes.length > 0 && (
                        <Card className="bg-green-500/5 border-green-500/20">
                            <CardHeader className="py-3">
                                <CardTitle className="text-base flex items-center gap-2 text-green-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Improvements
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4">
                                <ul className="space-y-2">
                                    {changelog.positive_changes.map((change, i) => (
                                        <li key={i} className="text-sm flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                                            {change}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Items */}
                    {changelog.action_items.length > 0 && (
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="py-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-primary" />
                                    Recommended Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 pb-4">
                                <ul className="space-y-2">
                                    {changelog.action_items.map((action, i) => (
                                        <li key={i} className="text-sm flex items-start gap-2">
                                            <span className="text-primary font-medium">{i + 1}.</span>
                                            {action}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Detailed Changes */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Detailed Changes ({changelog.changes.length})</h3>
                            
                            {/* Filters */}
                            <div className="flex gap-2">
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value as any)}
                                    className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10"
                                >
                                    <option value="ALL">All Types</option>
                                    <option value="WORSE">Worse ({worseCout})</option>
                                    <option value="BETTER">Better ({betterCount})</option>
                                    <option value="NEUTRAL">Neutral ({neutralCount})</option>
                                </select>
                                <select
                                    value={filterSeverity}
                                    onChange={(e) => setFilterSeverity(e.target.value as any)}
                                    className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10"
                                >
                                    <option value="ALL">All Severity</option>
                                    <option value="CRITICAL">🔴 Critical</option>
                                    <option value="HIGH">🟠 High</option>
                                    <option value="MEDIUM">🟡 Medium</option>
                                    <option value="LOW">🔵 Low</option>
                                </select>
                            </div>
                        </div>

                        {filteredChanges.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                                No changes match your filters
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {filteredChanges.map((change, index) => {
                                    const severityConfig = getSeverityConfig(change.severity)
                                    const typeConfig = getTypeConfig(change.type)
                                    const isExpanded = expandedItems.has(index)

                                    return (
                                        <div 
                                            key={index}
                                            className={cn(
                                                "rounded-lg border transition-all",
                                                severityConfig.bg,
                                                severityConfig.border
                                            )}
                                        >
                                            <button
                                                onClick={() => toggleItem(index)}
                                                className="w-full p-4 text-left"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-lg">{severityConfig.emoji}</span>
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={cn(
                                                                    "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                                                                    typeConfig.bg,
                                                                    typeConfig.text
                                                                )}>
                                                                    {typeConfig.icon}
                                                                    {change.type}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {change.category}
                                                                </span>
                                                            </div>
                                                            <h4 className="font-medium">{change.title}</h4>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4 flex-shrink-0" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                                    )}
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 space-y-3">
                                                    <p className="text-sm text-muted-foreground">
                                                        {change.description}
                                                    </p>

                                                    {(change.old_text || change.new_text) && (
                                                        <div className="grid md:grid-cols-2 gap-3">
                                                            {change.old_text && (
                                                                <div className="p-3 rounded bg-red-500/5 border border-red-500/20">
                                                                    <p className="text-xs text-red-400 font-medium mb-1">
                                                                        Previous Text:
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground italic">
                                                                        "{change.old_text}"
                                                                    </p>
                                                                </div>
                                                            )}
                                                            {change.new_text && (
                                                                <div className="p-3 rounded bg-green-500/5 border border-green-500/20">
                                                                    <p className="text-xs text-green-400 font-medium mb-1">
                                                                        New Text:
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground italic">
                                                                        "{change.new_text}"
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="p-3 rounded bg-primary/5 border border-primary/20">
                                                        <p className="text-xs text-primary font-medium mb-1">
                                                            What this means for you:
                                                        </p>
                                                        <p className="text-sm">
                                                            {change.user_impact}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex justify-end gap-3">
                    {onClose && (
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
