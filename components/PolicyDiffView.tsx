"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { X, ArrowRight, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Minus, Plus, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { clsx } from "clsx"

interface PolicyAnalysis {
    score: number;
    summary: string;
    key_findings: Array<{ category: string; text: string } | string>;
    data_collected: string[];
    third_party_sharing: string[];
    rawPolicyText?: string;
}

interface PolicyDiffViewProps {
    domain: string;
    oldAnalysis: PolicyAnalysis | null;
    newAnalysis: PolicyAnalysis;
    onClose: () => void;
    onMarkAsViewed: () => void;
}

export default function PolicyDiffView({ 
    domain, 
    oldAnalysis, 
    newAnalysis, 
    onClose,
    onMarkAsViewed 
}: PolicyDiffViewProps) {
    const [showFindingsExpanded, setShowFindingsExpanded] = useState(true)
    const [showDataExpanded, setShowDataExpanded] = useState(false)

    const scoreDiff = oldAnalysis ? newAnalysis.score - oldAnalysis.score : 0;
    const scoreImproved = scoreDiff > 0;

    // Find new, removed, and unchanged findings
    const oldFindingsTexts = new Set(
        oldAnalysis?.key_findings?.map(f => typeof f === 'string' ? f : f.text) || []
    );
    const newFindingsTexts = new Set(
        newAnalysis.key_findings?.map(f => typeof f === 'string' ? f : f.text) || []
    );

    const addedFindings = newAnalysis.key_findings?.filter(f => {
        const text = typeof f === 'string' ? f : f.text;
        return !oldFindingsTexts.has(text);
    }) || [];

    const removedFindings = oldAnalysis?.key_findings?.filter(f => {
        const text = typeof f === 'string' ? f : f.text;
        return !newFindingsTexts.has(text);
    }) || [];

    // Find new and removed data collection
    const oldDataSet = new Set(oldAnalysis?.data_collected || []);
    const newDataSet = new Set(newAnalysis.data_collected || []);
    
    const addedData = newAnalysis.data_collected?.filter(d => !oldDataSet.has(d)) || [];
    const removedData = oldAnalysis?.data_collected?.filter(d => !newDataSet.has(d)) || [];

    // Find new and removed third party sharing
    const oldThirdPartySet = new Set(oldAnalysis?.third_party_sharing || []);
    const newThirdPartySet = new Set(newAnalysis.third_party_sharing || []);
    
    const addedThirdParty = newAnalysis.third_party_sharing?.filter(t => !oldThirdPartySet.has(t)) || [];
    const removedThirdParty = oldAnalysis?.third_party_sharing?.filter(t => !newThirdPartySet.has(t)) || [];

    const getFindingCategory = (finding: { category: string; text: string } | string): string => {
        return typeof finding === 'object' ? finding.category : 'NORMAL';
    };

    const getFindingText = (finding: { category: string; text: string } | string): string => {
        return typeof finding === 'object' ? finding.text : finding;
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'THREAT': return 'text-red-500 bg-red-500/10 border-red-500/30';
            case 'WARNING': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'CAUTION': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
            case 'GOOD': return 'text-green-400 bg-green-500/10 border-green-500/30';
            case 'BRILLIANT': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
            default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-background border border-white/10 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <RefreshCw className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Policy Changes Detected</h3>
                            <p className="text-sm text-muted-foreground">{domain}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Score Comparison */}
                    <Card className="bg-white/5 border-white/10">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-1">Previous Score</p>
                                    <span className={clsx(
                                        "text-4xl font-bold",
                                        (oldAnalysis?.score || 0) >= 80 ? "text-green-400" :
                                            (oldAnalysis?.score || 0) >= 60 ? "text-yellow-400" :
                                                "text-red-500"
                                    )}>
                                        {oldAnalysis?.score ?? 'N/A'}
                                    </span>
                                </div>
                                
                                <div className="flex flex-col items-center gap-2">
                                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                                    {scoreDiff !== 0 && (
                                        <div className={clsx(
                                            "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                                            scoreImproved 
                                                ? "bg-green-500/20 text-green-400" 
                                                : "bg-red-500/20 text-red-400"
                                        )}>
                                            {scoreImproved 
                                                ? <TrendingUp className="h-4 w-4" /> 
                                                : <TrendingDown className="h-4 w-4" />
                                            }
                                            {scoreImproved ? '+' : ''}{scoreDiff}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground mb-1">New Score</p>
                                    <span className={clsx(
                                        "text-4xl font-bold",
                                        newAnalysis.score >= 80 ? "text-green-400" :
                                            newAnalysis.score >= 60 ? "text-yellow-400" :
                                                "text-red-500"
                                    )}>
                                        {newAnalysis.score}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Comparison */}
                    {oldAnalysis?.summary !== newAnalysis.summary && (
                        <div className="space-y-3">
                            <h4 className="font-semibold text-foreground">Summary Updated</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                                    <p className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1">
                                        <Minus className="h-3 w-3" /> Previous
                                    </p>
                                    <p className="text-sm text-muted-foreground">{oldAnalysis?.summary || 'N/A'}</p>
                                </div>
                                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                                    <p className="text-xs text-green-400 font-medium mb-2 flex items-center gap-1">
                                        <Plus className="h-3 w-3" /> New
                                    </p>
                                    <p className="text-sm text-muted-foreground">{newAnalysis.summary}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Key Findings Changes */}
                    {(addedFindings.length > 0 || removedFindings.length > 0) && (
                        <div className="space-y-3">
                            <button 
                                onClick={() => setShowFindingsExpanded(!showFindingsExpanded)}
                                className="flex items-center justify-between w-full"
                            >
                                <h4 className="font-semibold text-foreground flex items-center gap-2">
                                    Key Findings Changes
                                    <span className="text-xs font-normal text-muted-foreground">
                                        ({addedFindings.length} added, {removedFindings.length} removed)
                                    </span>
                                </h4>
                                {showFindingsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            
                            {showFindingsExpanded && (
                                <div className="space-y-2">
                                    {/* Added Findings */}
                                    {addedFindings.map((finding, i) => (
                                        <div 
                                            key={`added-${i}`}
                                            className={clsx(
                                                "p-3 rounded-lg border-l-4 flex items-start gap-3",
                                                "bg-green-500/5 border-l-green-500"
                                            )}
                                        >
                                            <Plus className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <span className={clsx(
                                                    "inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded mb-1",
                                                    getCategoryColor(getFindingCategory(finding))
                                                )}>
                                                    {getFindingCategory(finding)}
                                                </span>
                                                <p className="text-sm">{getFindingText(finding)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Removed Findings */}
                                    {removedFindings.map((finding, i) => (
                                        <div 
                                            key={`removed-${i}`}
                                            className={clsx(
                                                "p-3 rounded-lg border-l-4 flex items-start gap-3 opacity-70",
                                                "bg-red-500/5 border-l-red-500"
                                            )}
                                        >
                                            <Minus className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <span className={clsx(
                                                    "inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded mb-1",
                                                    getCategoryColor(getFindingCategory(finding))
                                                )}>
                                                    {getFindingCategory(finding)}
                                                </span>
                                                <p className="text-sm line-through">{getFindingText(finding)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Data Collection & Third Party Changes */}
                    {(addedData.length > 0 || removedData.length > 0 || addedThirdParty.length > 0 || removedThirdParty.length > 0) && (
                        <div className="space-y-3">
                            <button 
                                onClick={() => setShowDataExpanded(!showDataExpanded)}
                                className="flex items-center justify-between w-full"
                            >
                                <h4 className="font-semibold text-foreground">Data & Sharing Changes</h4>
                                {showDataExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {showDataExpanded && (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Data Collected Changes */}
                                    {(addedData.length > 0 || removedData.length > 0) && (
                                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                            <h5 className="text-sm font-medium mb-3">Data Collected</h5>
                                            <div className="space-y-1">
                                                {addedData.map((d, i) => (
                                                    <div key={`added-data-${i}`} className="flex items-center gap-2 text-sm text-green-400">
                                                        <Plus className="h-3 w-3" /> {d}
                                                    </div>
                                                ))}
                                                {removedData.map((d, i) => (
                                                    <div key={`removed-data-${i}`} className="flex items-center gap-2 text-sm text-red-400 line-through opacity-70">
                                                        <Minus className="h-3 w-3" /> {d}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Third Party Changes */}
                                    {(addedThirdParty.length > 0 || removedThirdParty.length > 0) && (
                                        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                            <h5 className="text-sm font-medium mb-3">Third Party Sharing</h5>
                                            <div className="space-y-1">
                                                {addedThirdParty.map((t, i) => (
                                                    <div key={`added-third-${i}`} className="flex items-center gap-2 text-sm text-orange-400">
                                                        <Plus className="h-3 w-3" /> {t}
                                                    </div>
                                                ))}
                                                {removedThirdParty.map((t, i) => (
                                                    <div key={`removed-third-${i}`} className="flex items-center gap-2 text-sm text-green-400 line-through opacity-70">
                                                        <Minus className="h-3 w-3" /> {t}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <p className="text-xs text-muted-foreground">
                        Changes detected help you understand how privacy policies evolve over time.
                    </p>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose}>
                            Close
                        </Button>
                        <Button onClick={() => { onMarkAsViewed(); onClose(); }}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Mark as Viewed
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
