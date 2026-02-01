"use client";

import { useState, useEffect } from "react";
import { Clock, ChevronDown, ChevronUp, GitCompare, Loader2, Calendar, FileText, TrendingUp, TrendingDown, Minus, Lock, ArrowRight, X, Plus, Minus as MinusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPolicyVersionHistory, getPolicyVersionById, comparePolicyVersions, PolicyVersion, PolicyVersionDetail } from "@/app/versionActions";

interface PolicyVersionsProps {
    domain: string;
    policyType?: string;
    isPro: boolean;
    onVersionSelect?: (analysis: any) => void;
}

export default function PolicyVersions({ domain, policyType = 'privacy', isPro, onVersionSelect }: PolicyVersionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [versions, setVersions] = useState<PolicyVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Comparison state
    const [compareMode, setCompareMode] = useState(false);
    const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
    const [comparison, setComparison] = useState<any | null>(null);
    const [comparingLoading, setComparingLoading] = useState(false);

    // Load versions when opened
    useEffect(() => {
        if (isOpen && versions.length === 0) {
            loadVersions();
        }
    }, [isOpen]);

    const loadVersions = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await getPolicyVersionHistory(domain, policyType);
            if (result.success && result.versions) {
                setVersions(result.versions);
            } else {
                setError(result.error || 'Failed to load versions');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVersionClick = async (version: PolicyVersion) => {
        if (compareMode) {
            // Toggle selection for comparison
            setSelectedVersions(prev => {
                if (prev.includes(version.id)) {
                    return prev.filter(id => id !== version.id);
                }
                if (prev.length >= 2) {
                    // Replace oldest selection
                    return [prev[1], version.id];
                }
                return [...prev, version.id];
            });
        } else if (onVersionSelect) {
            // Load full version and pass to parent
            setLoading(true);
            try {
                const result = await getPolicyVersionById(version.id);
                if (result.success && result.version) {
                    onVersionSelect({
                        ...result.version.analysis_data,
                        url: result.version.policy_url,
                        rawPolicyText: result.version.raw_text,
                        viewingVersion: {
                            id: version.id,
                            date: version.analyzed_at
                        }
                    });
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const runComparison = async () => {
        if (selectedVersions.length !== 2) return;
        
        setComparingLoading(true);
        try {
            const result = await comparePolicyVersions(selectedVersions[0], selectedVersions[1]);
            if (result.success && result.comparison) {
                setComparison(result.comparison);
            } else {
                setError(result.error || 'Comparison failed');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setComparingLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return 'text-gray-400';
        if (score >= 70) return 'text-green-400';
        if (score >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    if (!isPro) {
        return (
            <Card className="bg-white/5 border-white/10 mt-4">
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-amber-400" />
                        <div>
                            <p className="text-white font-medium">Policy Version History</p>
                            <p className="text-white/60 text-sm">
                                Upgrade to Pro to view historical versions and compare policy changes over time.
                            </p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="ml-auto border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
                        >
                            Upgrade
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-white/5 border-white/10 mt-4">
            <CardHeader 
                className="cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <CardTitle className="text-white text-lg">Policy Version History</CardTitle>
                        {versions.length > 0 && (
                            <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">
                                {versions.length} version{versions.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-white/60" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-white/60" />
                    )}
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="pt-0">
                    {loading && !comparison && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                            <span className="ml-2 text-white/60">Loading versions...</span>
                        </div>
                    )}

                    {error && (
                        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {!loading && versions.length === 0 && !error && (
                        <div className="text-white/60 text-center py-8">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No version history available yet.</p>
                            <p className="text-sm mt-1">Versions are saved when policies are analyzed.</p>
                        </div>
                    )}

                    {/* Comparison Mode Toggle */}
                    {versions.length >= 2 && !comparison && (
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <GitCompare className="w-4 h-4 text-purple-400" />
                                <span className="text-white/80 text-sm">Compare versions</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {compareMode && selectedVersions.length === 2 && (
                                    <Button
                                        size="sm"
                                        onClick={runComparison}
                                        disabled={comparingLoading}
                                        className="bg-purple-500 hover:bg-purple-600 text-white"
                                    >
                                        {comparingLoading ? (
                                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                        ) : (
                                            <ArrowRight className="w-4 h-4 mr-1" />
                                        )}
                                        Compare
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant={compareMode ? "default" : "outline"}
                                    onClick={() => {
                                        setCompareMode(!compareMode);
                                        setSelectedVersions([]);
                                    }}
                                    className={compareMode 
                                        ? "bg-purple-500 hover:bg-purple-600" 
                                        : "border-purple-400/50 text-purple-400 hover:bg-purple-400/10"
                                    }
                                >
                                    {compareMode ? 'Cancel' : 'Select to Compare'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Comparison Results */}
                    {comparison && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-white font-medium flex items-center gap-2">
                                    <GitCompare className="w-4 h-4 text-purple-400" />
                                    Comparison Results
                                </h4>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                        setComparison(null);
                                        setSelectedVersions([]);
                                        setCompareMode(false);
                                    }}
                                    className="text-white/60 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Version Dates */}
                            <div className="flex items-center gap-2 text-sm mb-4 text-white/60">
                                <span>{formatDate(comparison.version1.analyzed_at)}</span>
                                <ArrowRight className="w-4 h-4" />
                                <span>{formatDate(comparison.version2.analyzed_at)}</span>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-white/60 text-xs mb-1">Score Change</div>
                                    <div className="flex items-center gap-2">
                                        {comparison.scoreDiff > 0 ? (
                                            <TrendingUp className="w-5 h-5 text-green-400" />
                                        ) : comparison.scoreDiff < 0 ? (
                                            <TrendingDown className="w-5 h-5 text-red-400" />
                                        ) : (
                                            <Minus className="w-5 h-5 text-gray-400" />
                                        )}
                                        <span className={`text-xl font-bold ${
                                            comparison.scoreDiff > 0 ? 'text-green-400' : 
                                            comparison.scoreDiff < 0 ? 'text-red-400' : 'text-gray-400'
                                        }`}>
                                            {comparison.scoreDiff > 0 ? '+' : ''}{comparison.scoreDiff}
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-lg p-3">
                                    <div className="text-white/60 text-xs mb-1">Word Count Change</div>
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-blue-400" />
                                        <span className="text-xl font-bold text-white">
                                            {comparison.wordCountDiff > 0 ? '+' : ''}{comparison.wordCountDiff}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Text Changes Summary */}
                            <div className="bg-white/5 rounded-lg p-4 mb-4">
                                <h5 className="text-white/80 text-sm font-medium mb-3">Text Changes</h5>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
                                            <Plus className="w-4 h-4" />
                                            <span className="text-lg font-bold">{comparison.textDiff.added.length}</span>
                                        </div>
                                        <div className="text-white/60 text-xs">Added</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
                                            <MinusIcon className="w-4 h-4" />
                                            <span className="text-lg font-bold">{comparison.textDiff.removed.length}</span>
                                        </div>
                                        <div className="text-white/60 text-xs">Removed</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                                            <span className="text-lg font-bold">{comparison.textDiff.unchanged}</span>
                                        </div>
                                        <div className="text-white/60 text-xs">Unchanged</div>
                                    </div>
                                </div>
                            </div>

                            {/* Added Paragraphs */}
                            {comparison.textDiff.added.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
                                        <Plus className="w-4 h-4" /> Added Content
                                    </h5>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {comparison.textDiff.added.slice(0, 5).map((text: string, i: number) => (
                                            <div key={i} className="bg-green-500/10 border border-green-500/20 rounded p-2 text-white/80 text-sm">
                                                {text.substring(0, 200)}
                                                {text.length > 200 && '...'}
                                            </div>
                                        ))}
                                        {comparison.textDiff.added.length > 5 && (
                                            <div className="text-white/60 text-sm">
                                                +{comparison.textDiff.added.length - 5} more sections
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Removed Paragraphs */}
                            {comparison.textDiff.removed.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="text-red-400 text-sm font-medium mb-2 flex items-center gap-1">
                                        <MinusIcon className="w-4 h-4" /> Removed Content
                                    </h5>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {comparison.textDiff.removed.slice(0, 5).map((text: string, i: number) => (
                                            <div key={i} className="bg-red-500/10 border border-red-500/20 rounded p-2 text-white/80 text-sm line-through opacity-70">
                                                {text.substring(0, 200)}
                                                {text.length > 200 && '...'}
                                            </div>
                                        ))}
                                        {comparison.textDiff.removed.length > 5 && (
                                            <div className="text-white/60 text-sm">
                                                +{comparison.textDiff.removed.length - 5} more sections
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Version List */}
                    {!comparison && versions.length > 0 && (
                        <div className="space-y-2">
                            {compareMode && (
                                <p className="text-white/60 text-sm mb-3">
                                    Select two versions to compare ({selectedVersions.length}/2 selected)
                                </p>
                            )}
                            {versions.map((version, index) => (
                                <div
                                    key={version.id}
                                    onClick={() => handleVersionClick(version)}
                                    className={`
                                        flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all
                                        ${selectedVersions.includes(version.id) 
                                            ? 'bg-purple-500/20 border border-purple-500/50' 
                                            : 'bg-white/5 hover:bg-white/10 border border-transparent'}
                                        ${index === 0 ? 'ring-1 ring-blue-500/30' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        {compareMode && (
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                selectedVersions.includes(version.id)
                                                    ? 'border-purple-400 bg-purple-400'
                                                    : 'border-white/30'
                                            }`}>
                                                {selectedVersions.includes(version.id) && (
                                                    <span className="text-white text-xs font-bold">
                                                        {selectedVersions.indexOf(version.id) + 1}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-white/60" />
                                                <span className="text-white">
                                                    {formatDate(version.analyzed_at)}
                                                </span>
                                                {index === 0 && (
                                                    <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded">
                                                        Latest
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-white/60 text-sm mt-1">
                                                {version.word_count?.toLocaleString() || '?'} words
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold ${getScoreColor(version.score)}`}>
                                        {version.score !== null ? version.score : '-'}/100
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
