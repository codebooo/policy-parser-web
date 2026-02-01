'use client'

import { useState, useEffect } from 'react'
import { 
    Database,
    Mail,
    Phone,
    MapPin,
    CreditCard,
    User,
    Globe,
    Calendar,
    FileText,
    Heart,
    Briefcase,
    Camera,
    MessageSquare,
    Fingerprint,
    ChevronDown,
    ChevronUp,
    Loader2,
    AlertCircle,
    RefreshCw,
    Eye,
    Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DataExposureMapProps {
    userId: string
}

// Map data types to icons and categories
const DATA_TYPE_CONFIG: Record<string, { icon: React.ReactNode; category: string; risk: 'low' | 'medium' | 'high' }> = {
    // Identity
    'Email addresses': { icon: <Mail className="h-4 w-4" />, category: 'Identity', risk: 'medium' },
    'Email': { icon: <Mail className="h-4 w-4" />, category: 'Identity', risk: 'medium' },
    'Names': { icon: <User className="h-4 w-4" />, category: 'Identity', risk: 'low' },
    'Name': { icon: <User className="h-4 w-4" />, category: 'Identity', risk: 'low' },
    'Full name': { icon: <User className="h-4 w-4" />, category: 'Identity', risk: 'low' },
    'Phone numbers': { icon: <Phone className="h-4 w-4" />, category: 'Identity', risk: 'medium' },
    'Phone number': { icon: <Phone className="h-4 w-4" />, category: 'Identity', risk: 'medium' },
    'Date of birth': { icon: <Calendar className="h-4 w-4" />, category: 'Identity', risk: 'medium' },
    'Age': { icon: <Calendar className="h-4 w-4" />, category: 'Identity', risk: 'low' },
    
    // Location
    'Location': { icon: <MapPin className="h-4 w-4" />, category: 'Location', risk: 'medium' },
    'Physical addresses': { icon: <MapPin className="h-4 w-4" />, category: 'Location', risk: 'high' },
    'IP Address': { icon: <Globe className="h-4 w-4" />, category: 'Location', risk: 'medium' },
    'IP addresses': { icon: <Globe className="h-4 w-4" />, category: 'Location', risk: 'medium' },
    'Precise location': { icon: <MapPin className="h-4 w-4" />, category: 'Location', risk: 'high' },
    'GPS data': { icon: <MapPin className="h-4 w-4" />, category: 'Location', risk: 'high' },
    
    // Financial
    'Credit cards': { icon: <CreditCard className="h-4 w-4" />, category: 'Financial', risk: 'high' },
    'Payment information': { icon: <CreditCard className="h-4 w-4" />, category: 'Financial', risk: 'high' },
    'Bank account numbers': { icon: <CreditCard className="h-4 w-4" />, category: 'Financial', risk: 'high' },
    'Purchase history': { icon: <Briefcase className="h-4 w-4" />, category: 'Financial', risk: 'medium' },
    'Transaction history': { icon: <Briefcase className="h-4 w-4" />, category: 'Financial', risk: 'medium' },
    
    // Biometric
    'Biometric data': { icon: <Fingerprint className="h-4 w-4" />, category: 'Biometric', risk: 'high' },
    'Face recognition': { icon: <Camera className="h-4 w-4" />, category: 'Biometric', risk: 'high' },
    'Fingerprints': { icon: <Fingerprint className="h-4 w-4" />, category: 'Biometric', risk: 'high' },
    'Voice data': { icon: <MessageSquare className="h-4 w-4" />, category: 'Biometric', risk: 'high' },
    
    // Sensitive
    'Health data': { icon: <Heart className="h-4 w-4" />, category: 'Sensitive', risk: 'high' },
    'Medical information': { icon: <Heart className="h-4 w-4" />, category: 'Sensitive', risk: 'high' },
    'Passwords': { icon: <Shield className="h-4 w-4" />, category: 'Sensitive', risk: 'high' },
    'Social security numbers': { icon: <FileText className="h-4 w-4" />, category: 'Sensitive', risk: 'high' },
    
    // Behavioral
    'Browsing history': { icon: <Eye className="h-4 w-4" />, category: 'Behavioral', risk: 'medium' },
    'Search history': { icon: <Eye className="h-4 w-4" />, category: 'Behavioral', risk: 'medium' },
    'Usage data': { icon: <Database className="h-4 w-4" />, category: 'Behavioral', risk: 'low' },
    'Device information': { icon: <Database className="h-4 w-4" />, category: 'Behavioral', risk: 'low' },
    'Cookies': { icon: <Database className="h-4 w-4" />, category: 'Behavioral', risk: 'low' },
}

const CATEGORY_COLORS: Record<string, string> = {
    'Identity': 'bg-blue-500',
    'Location': 'bg-green-500',
    'Financial': 'bg-yellow-500',
    'Biometric': 'bg-purple-500',
    'Sensitive': 'bg-red-500',
    'Behavioral': 'bg-cyan-500',
    'Other': 'bg-gray-500'
}

export default function DataExposureMap({ userId }: DataExposureMapProps) {
    const [exposureMap, setExposureMap] = useState<Record<string, string[]> | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
    const [viewMode, setViewMode] = useState<'byData' | 'byService'>('byData')

    useEffect(() => {
        loadExposureMap()
    }, [userId])

    const loadExposureMap = async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/risk/exposure-map')
            const data = await response.json()
            
            if (data.success) {
                setExposureMap(data.exposureMap)
            } else {
                setError(data.error || 'Failed to load exposure map')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleType = (type: string) => {
        setExpandedTypes(prev => {
            const newSet = new Set(prev)
            if (newSet.has(type)) {
                newSet.delete(type)
            } else {
                newSet.add(type)
            }
            return newSet
        })
    }

    const getDataTypeConfig = (type: string) => {
        return DATA_TYPE_CONFIG[type] || {
            icon: <Database className="h-4 w-4" />,
            category: 'Other',
            risk: 'low' as const
        }
    }

    const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
        switch (risk) {
            case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30'
            case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
            case 'high': return 'text-red-400 bg-red-500/10 border-red-500/30'
        }
    }

    // Group data by category
    const groupedByCategory = () => {
        if (!exposureMap) return {}
        
        const grouped: Record<string, { type: string; services: string[] }[]> = {}
        
        for (const [dataType, services] of Object.entries(exposureMap)) {
            const config = getDataTypeConfig(dataType)
            if (!grouped[config.category]) {
                grouped[config.category] = []
            }
            grouped[config.category].push({ type: dataType, services })
        }
        
        return grouped
    }

    // Get services with their collected data
    const getServiceMap = () => {
        if (!exposureMap) return {}
        
        const serviceMap: Record<string, string[]> = {}
        
        for (const [dataType, services] of Object.entries(exposureMap)) {
            for (const service of services) {
                if (!serviceMap[service]) {
                    serviceMap[service] = []
                }
                serviceMap[service].push(dataType)
            }
        }
        
        return serviceMap
    }

    if (loading) {
        return (
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Mapping your data exposure...</p>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{error}</p>
                    <Button variant="outline" onClick={loadExposureMap}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        )
    }

    if (!exposureMap || Object.keys(exposureMap).length === 0) {
        return (
            <Card className="bg-white/5 border-white/10">
                <CardContent className="p-8 text-center">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">No Data Exposure Yet</h3>
                    <p className="text-muted-foreground text-sm">
                        Start analyzing services to see what data they collect from you.
                    </p>
                </CardContent>
            </Card>
        )
    }

    const grouped = groupedByCategory()
    const serviceMap = getServiceMap()
    const totalDataTypes = Object.keys(exposureMap).length
    const totalServices = Object.keys(serviceMap).length

    return (
        <Card className="bg-white/5 border-white/10">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Your Data Exposure Map
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant={viewMode === 'byData' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('byData')}
                        >
                            By Data Type
                        </Button>
                        <Button
                            variant={viewMode === 'byService' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('byService')}
                        >
                            By Service
                        </Button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    {totalServices} services collect {totalDataTypes} types of data from you
                </p>
            </CardHeader>
            <CardContent>
                {viewMode === 'byData' ? (
                    // View by Data Type (grouped by category)
                    <div className="space-y-6">
                        {Object.entries(grouped).map(([category, items]) => (
                            <div key={category}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className={cn(
                                        "h-3 w-3 rounded-full",
                                        CATEGORY_COLORS[category] || CATEGORY_COLORS['Other']
                                    )} />
                                    <h3 className="font-medium">{category}</h3>
                                    <span className="text-xs text-muted-foreground">
                                        ({items.length} types)
                                    </span>
                                </div>
                                <div className="grid gap-2">
                                    {items.map(({ type, services }) => {
                                        const config = getDataTypeConfig(type)
                                        const isExpanded = expandedTypes.has(type)
                                        
                                        return (
                                            <div key={type}>
                                                <button
                                                    onClick={() => toggleType(type)}
                                                    className={cn(
                                                        "w-full p-3 rounded-lg border transition-all text-left",
                                                        getRiskColor(config.risk)
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            {config.icon}
                                                            <span className="font-medium">{type}</span>
                                                            <span className={cn(
                                                                "text-xs px-2 py-0.5 rounded-full",
                                                                config.risk === 'high' ? "bg-red-500/20" :
                                                                config.risk === 'medium' ? "bg-yellow-500/20" :
                                                                "bg-green-500/20"
                                                            )}>
                                                                {config.risk.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-muted-foreground">
                                                                {services.length} service{services.length !== 1 ? 's' : ''}
                                                            </span>
                                                            {isExpanded ? (
                                                                <ChevronUp className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                                {isExpanded && (
                                                    <div className="mt-2 ml-8 flex flex-wrap gap-2">
                                                        {services.map(service => (
                                                            <span 
                                                                key={service}
                                                                className="px-2 py-1 rounded-full bg-white/5 text-xs"
                                                            >
                                                                {service}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // View by Service
                    <div className="space-y-3">
                        {Object.entries(serviceMap)
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([service, dataTypes]) => {
                                const highRiskCount = dataTypes.filter(
                                    t => getDataTypeConfig(t).risk === 'high'
                                ).length
                                const isExpanded = expandedTypes.has(service)
                                
                                return (
                                    <div key={service}>
                                        <button
                                            onClick={() => toggleType(service)}
                                            className={cn(
                                                "w-full p-4 rounded-lg border transition-all text-left",
                                                highRiskCount > 2 ? "bg-red-500/5 border-red-500/20" :
                                                highRiskCount > 0 ? "bg-yellow-500/5 border-yellow-500/20" :
                                                "bg-white/5 border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Globe className="h-5 w-5 text-muted-foreground" />
                                                    <span className="font-medium">{service}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm">
                                                        {dataTypes.length} data types
                                                    </span>
                                                    {highRiskCount > 0 && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                                            {highRiskCount} high risk
                                                        </span>
                                                    )}
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                        {isExpanded && (
                                            <div className="mt-2 ml-8 flex flex-wrap gap-2">
                                                {dataTypes.map(type => {
                                                    const config = getDataTypeConfig(type)
                                                    return (
                                                        <span 
                                                            key={type}
                                                            className={cn(
                                                                "px-2 py-1 rounded-full text-xs flex items-center gap-1",
                                                                getRiskColor(config.risk)
                                                            )}
                                                        >
                                                            {config.icon}
                                                            {type}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
