'use client'

import { useState, useEffect } from 'react'
import { 
    Shield, 
    AlertTriangle, 
    CheckCircle2, 
    TrendingUp,
    TrendingDown,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Lock,
    Database,
    Globe,
    Target,
    AlertCircle,
    ExternalLink,
    Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface RiskFactors {
    analyzedServicesScore: number
    breachExposure: number
    concerningServicesCount: number
    highRiskServicesCount: number
    regionRisk: number
    dataExposureIndex: number
}

interface TopConcern {
    domain: string
    score: number
    mainConcern: string
}

interface BreachSummary {
    total: number
    critical: number
    recent: number
    exposedData: string[]
}

interface PersonalRiskProfile {
    overallScore: number
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
    factors: RiskFactors
    recommendations: string[]
    topConcerns: TopConcern[]
    breachSummary?: BreachSummary
}

interface RiskProfileDashboardProps {
    userId: string
    email: string
    onRefresh?: () => void
}

export default function RiskProfileDashboard({ 
    userId,
    email,
    onRefresh 
}: RiskProfileDashboardProps) {
    const [profile, setProfile] = useState<PersonalRiskProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [checkingBreaches, setCheckingBreaches] = useState(false)
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        recommendations: true,
        concerns: false,
        breaches: false
    })
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadProfile()
    }, [userId])

    const loadProfile = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/risk/profile')
            const data = await response.json()
            
            if (data.success) {
                setProfile(data.profile)
            } else {
                setError(data.error || 'Failed to load profile')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const checkBreaches = async () => {
        setCheckingBreaches(true)
        try {
            const response = await fetch('/api/risk/check-breaches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            const data = await response.json()
            
            if (data.success) {
                // Reload profile to get updated breach data
                await loadProfile()
            }
        } catch (err) {
            console.error('Breach check failed:', err)
        } finally {
            setCheckingBreaches(false)
        }
    }

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'LOW': return 'text-green-400'
            case 'MODERATE': return 'text-yellow-400'
            case 'HIGH': return 'text-orange-500'
            case 'CRITICAL': return 'text-red-500'
            default: return 'text-muted-foreground'
        }
    }

    const getRiskBg = (level: string) => {
        switch (level) {
            case 'LOW': return 'bg-green-500/10 border-green-500/30'
            case 'MODERATE': return 'bg-yellow-500/10 border-yellow-500/30'
            case 'HIGH': return 'bg-orange-500/10 border-orange-500/30'
            case 'CRITICAL': return 'bg-red-500/10 border-red-500/30'
            default: return 'bg-white/5 border-white/10'
        }
    }

    const getScoreColor = (score: number) => {
        if (score >= 75) return 'text-green-400'
        if (score >= 50) return 'text-yellow-400'
        if (score >= 25) return 'text-orange-500'
        return 'text-red-500'
    }

    if (loading) {
        return (
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Calculating your risk profile...</p>
                </CardContent>
            </Card>
        )
    }

    if (error || !profile) {
        return (
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{error || 'Could not load risk profile'}</p>
                    <Button variant="outline" onClick={loadProfile}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Main Score Card */}
            <Card className={cn("border-2 transition-all", getRiskBg(profile.riskLevel))}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "h-20 w-20 rounded-2xl flex items-center justify-center",
                                profile.riskLevel === 'LOW' ? "bg-green-500/20" :
                                profile.riskLevel === 'MODERATE' ? "bg-yellow-500/20" :
                                profile.riskLevel === 'HIGH' ? "bg-orange-500/20" :
                                "bg-red-500/20"
                            )}>
                                <span className={cn("text-4xl font-bold", getScoreColor(profile.overallScore))}>
                                    {profile.overallScore}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Personal Privacy Score</h3>
                                <p className={cn("text-lg font-medium", getRiskColor(profile.riskLevel))}>
                                    {profile.riskLevel === 'LOW' && '🛡️ Well Protected'}
                                    {profile.riskLevel === 'MODERATE' && '⚠️ Room for Improvement'}
                                    {profile.riskLevel === 'HIGH' && '🔴 Action Needed'}
                                    {profile.riskLevel === 'CRITICAL' && '🚨 Critical Risk'}
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadProfile}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>

                    {/* Factor Breakdown */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <Target className="h-4 w-4" />
                                Services Score
                            </div>
                            <span className={cn("text-xl font-semibold", getScoreColor(profile.factors.analyzedServicesScore))}>
                                {profile.factors.analyzedServicesScore}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <AlertTriangle className="h-4 w-4" />
                                Breaches
                            </div>
                            <span className={cn(
                                "text-xl font-semibold",
                                profile.factors.breachExposure > 5 ? "text-red-500" :
                                profile.factors.breachExposure > 0 ? "text-orange-500" :
                                "text-green-400"
                            )}>
                                {profile.factors.breachExposure}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <Database className="h-4 w-4" />
                                High Risk
                            </div>
                            <span className={cn(
                                "text-xl font-semibold",
                                profile.factors.highRiskServicesCount > 2 ? "text-red-500" :
                                profile.factors.highRiskServicesCount > 0 ? "text-orange-500" :
                                "text-green-400"
                            )}>
                                {profile.factors.highRiskServicesCount}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5">
                            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                <Globe className="h-4 w-4" />
                                Region Risk
                            </div>
                            <span className={cn(
                                "text-xl font-semibold",
                                profile.factors.regionRisk > 50 ? "text-orange-500" :
                                profile.factors.regionRisk > 30 ? "text-yellow-400" :
                                "text-green-400"
                            )}>
                                {profile.factors.regionRisk > 50 ? 'High' : profile.factors.regionRisk > 30 ? 'Medium' : 'Low'}
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Recommendations Section */}
            <Card className="bg-white/5 border-white/10">
                <button 
                    onClick={() => toggleSection('recommendations')}
                    className="w-full"
                >
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Personalized Recommendations
                        </CardTitle>
                        {expandedSections.recommendations ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </CardHeader>
                </button>
                {expandedSections.recommendations && (
                    <CardContent className="pt-0 pb-4">
                        <div className="space-y-3">
                            {profile.recommendations.map((rec, i) => (
                                <div 
                                    key={i}
                                    className="p-3 rounded-lg bg-white/5 border border-white/5 text-sm"
                                >
                                    {rec}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Top Concerns Section */}
            {profile.topConcerns.length > 0 && (
                <Card className="bg-white/5 border-white/10">
                    <button 
                        onClick={() => toggleSection('concerns')}
                        className="w-full"
                    >
                        <CardHeader className="flex flex-row items-center justify-between py-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                Top Privacy Concerns ({profile.topConcerns.length})
                            </CardTitle>
                            {expandedSections.concerns ? (
                                <ChevronUp className="h-5 w-5" />
                            ) : (
                                <ChevronDown className="h-5 w-5" />
                            )}
                        </CardHeader>
                    </button>
                    {expandedSections.concerns && (
                        <CardContent className="pt-0 pb-4">
                            <div className="space-y-3">
                                {profile.topConcerns.map((concern, i) => (
                                    <div 
                                        key={i}
                                        className="p-4 rounded-lg bg-red-500/5 border border-red-500/20"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium">{concern.domain}</span>
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-medium",
                                                concern.score < 30 ? "bg-red-500/20 text-red-400" :
                                                "bg-orange-500/20 text-orange-400"
                                            )}>
                                                Score: {concern.score}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {concern.mainConcern}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* Breach Summary Section */}
            <Card className="bg-white/5 border-white/10">
                <button 
                    onClick={() => toggleSection('breaches')}
                    className="w-full"
                >
                    <CardHeader className="flex flex-row items-center justify-between py-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Lock className="h-5 w-5 text-purple-400" />
                            Data Breach Check
                            {profile.breachSummary && profile.breachSummary.total > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                                    {profile.breachSummary.total} found
                                </span>
                            )}
                        </CardTitle>
                        {expandedSections.breaches ? (
                            <ChevronUp className="h-5 w-5" />
                        ) : (
                            <ChevronDown className="h-5 w-5" />
                        )}
                    </CardHeader>
                </button>
                {expandedSections.breaches && (
                    <CardContent className="pt-0 pb-4">
                        {profile.breachSummary ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-3 rounded-lg bg-white/5 text-center">
                                        <div className="text-2xl font-bold text-red-400">
                                            {profile.breachSummary.total}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Total Breaches</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5 text-center">
                                        <div className="text-2xl font-bold text-orange-400">
                                            {profile.breachSummary.critical}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Critical</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-white/5 text-center">
                                        <div className="text-2xl font-bold text-yellow-400">
                                            {profile.breachSummary.recent}
                                        </div>
                                        <div className="text-xs text-muted-foreground">Recent (1yr)</div>
                                    </div>
                                </div>
                                
                                {profile.breachSummary.exposedData.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium mb-2">Exposed Data Types:</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.breachSummary.exposedData.map((dataType, i) => (
                                                <span 
                                                    key={i}
                                                    className={cn(
                                                        "px-2 py-1 rounded-full text-xs",
                                                        ['Passwords', 'Credit cards', 'Bank account numbers'].includes(dataType)
                                                            ? "bg-red-500/20 text-red-400"
                                                            : "bg-white/10 text-muted-foreground"
                                                    )}
                                                >
                                                    {dataType}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-muted-foreground mb-4">
                                    Check if your email appears in known data breaches
                                </p>
                                <Button 
                                    onClick={checkBreaches}
                                    disabled={checkingBreaches}
                                >
                                    {checkingBreaches ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Shield className="h-4 w-4 mr-2" />
                                    )}
                                    Check Now
                                </Button>
                            </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <a 
                                href="https://haveibeenpwned.com" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                Powered by Have I Been Pwned
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </CardContent>
                )}
            </Card>
        </div>
    )
}
