'use client'

import { useState } from 'react'
import { Globe, ChevronDown, Check, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Region {
    id: string
    label: string
    description: string
    laws: string[]
    flag: string
}

export const REGIONS: Region[] = [
    {
        id: 'EU',
        label: 'European Union',
        description: 'GDPR applies with strong privacy rights',
        laws: ['GDPR', 'ePrivacy'],
        flag: '🇪🇺'
    },
    {
        id: 'US_CA',
        label: 'California, USA',
        description: 'CCPA/CPRA provides data rights',
        laws: ['CCPA', 'CPRA'],
        flag: '🇺🇸'
    },
    {
        id: 'US_OTHER',
        label: 'United States (Other)',
        description: 'Limited federal privacy laws',
        laws: ['Sectoral Laws'],
        flag: '🇺🇸'
    },
    {
        id: 'UK',
        label: 'United Kingdom',
        description: 'UK GDPR post-Brexit',
        laws: ['UK GDPR', 'DPA 2018'],
        flag: '🇬🇧'
    },
    {
        id: 'CA',
        label: 'Canada',
        description: 'PIPEDA privacy protection',
        laws: ['PIPEDA'],
        flag: '🇨🇦'
    },
    {
        id: 'AU',
        label: 'Australia',
        description: 'Privacy Act protections',
        laws: ['Privacy Act 1988'],
        flag: '🇦🇺'
    },
    {
        id: 'BR',
        label: 'Brazil',
        description: 'LGPD data protection',
        laws: ['LGPD'],
        flag: '🇧🇷'
    },
    {
        id: 'OTHER',
        label: 'Other Region',
        description: 'General recommendations',
        laws: ['Varies'],
        flag: '🌍'
    }
]

interface RegionSelectorProps {
    selectedRegion: string | null
    onRegionChange: (region: string) => void
    loading?: boolean
    error?: string | null
    compact?: boolean
}

export default function RegionSelector({
    selectedRegion,
    onRegionChange,
    loading = false,
    error = null,
    compact = false
}: RegionSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    
    const selectedRegionData = REGIONS.find(r => r.id === selectedRegion)

    if (compact) {
        return (
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={loading}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                        "hover:bg-white/5",
                        selectedRegion 
                            ? "border-primary/50 bg-primary/10" 
                            : "border-white/10 bg-white/5"
                    )}
                >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                        {selectedRegionData ? (
                            <>
                                {selectedRegionData.flag} {selectedRegionData.label}
                            </>
                        ) : (
                            'Select region'
                        )}
                    </span>
                    <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-background border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                        {REGIONS.map((region) => (
                            <button
                                key={region.id}
                                type="button"
                                onClick={() => {
                                    onRegionChange(region.id)
                                    setIsOpen(false)
                                }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                                    "hover:bg-white/5",
                                    selectedRegion === region.id && "bg-primary/10"
                                )}
                            >
                                <span className="text-lg">{region.flag}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{region.label}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {region.laws.join(', ')}
                                    </div>
                                </div>
                                {selectedRegion === region.id && (
                                    <Check className="h-4 w-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="text-sm text-red-500 mt-1">{error}</div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    <Globe className="h-5 w-5 inline-block mr-2" />
                    Where are you located?
                </h3>
                <p className="text-sm text-muted-foreground">
                    This helps us show relevant privacy laws and rights
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {REGIONS.map((region) => {
                    const isSelected = selectedRegion === region.id

                    return (
                        <button
                            key={region.id}
                            type="button"
                            onClick={() => onRegionChange(region.id)}
                            disabled={loading}
                            className={cn(
                                "relative group p-4 rounded-xl border-2 transition-all duration-200 text-left",
                                "hover:scale-[1.02] active:scale-[0.98]",
                                isSelected 
                                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                            )}
                        >
                            {/* Selected indicator */}
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="h-4 w-4 text-primary-foreground" />
                                </div>
                            )}

                            {/* Flag */}
                            <div className="text-3xl mb-2">{region.flag}</div>

                            {/* Label */}
                            <h4 className={cn(
                                "font-medium text-sm mb-1 transition-colors",
                                isSelected ? "text-primary" : "text-foreground"
                            )}>
                                {region.label}
                            </h4>

                            {/* Laws */}
                            <div className="flex flex-wrap gap-1">
                                {region.laws.map((law) => (
                                    <span 
                                        key={law}
                                        className={cn(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            isSelected 
                                                ? "bg-primary/20 text-primary" 
                                                : "bg-white/10 text-muted-foreground"
                                        )}
                                    >
                                        {law}
                                    </span>
                                ))}
                            </div>
                        </button>
                    )
                })}
            </div>

            {error && (
                <div className="text-sm text-red-500 text-center p-2 bg-red-500/10 rounded-lg">
                    {error}
                </div>
            )}
        </div>
    )
}
