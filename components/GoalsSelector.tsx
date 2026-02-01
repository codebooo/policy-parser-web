'use client'

import { useState } from 'react'
import { 
    Shield, 
    Eye, 
    Users, 
    Building2, 
    Search, 
    Bell, 
    Scale, 
    Share2,
    Check,
    Loader2 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface UserGoal {
    id: string
    label: string
    description: string
    icon: React.ReactNode
}

export const USER_GOALS: UserGoal[] = [
    {
        id: 'avoid_data_selling',
        label: 'Stop Data Selling',
        description: 'Know which services sell my data to third parties',
        icon: <Shield className="h-5 w-5" />
    },
    {
        id: 'limit_tracking',
        label: 'Limit Tracking',
        description: 'Minimize cross-site tracking and targeted advertising',
        icon: <Eye className="h-5 w-5" />
    },
    {
        id: 'protect_family',
        label: 'Protect My Family',
        description: 'Keep kids safe from inappropriate data collection',
        icon: <Users className="h-5 w-5" />
    },
    {
        id: 'business_compliance',
        label: 'Business Compliance',
        description: 'Ensure services meet regulatory requirements',
        icon: <Building2 className="h-5 w-5" />
    },
    {
        id: 'find_safe_alternatives',
        label: 'Find Alternatives',
        description: 'Discover privacy-respecting service alternatives',
        icon: <Search className="h-5 w-5" />
    },
    {
        id: 'monitor_changes',
        label: 'Monitor Changes',
        description: 'Get alerts when policies change for the worse',
        icon: <Bell className="h-5 w-5" />
    },
    {
        id: 'understand_rights',
        label: 'Know My Rights',
        description: 'Understand what data rights I have under GDPR/CCPA',
        icon: <Scale className="h-5 w-5" />
    },
    {
        id: 'minimize_sharing',
        label: 'Minimize Sharing',
        description: 'Reduce third-party data sharing and partnerships',
        icon: <Share2 className="h-5 w-5" />
    }
]

interface GoalsSelectorProps {
    selectedGoals: string[]
    onGoalsChange: (goals: string[]) => void
    minRequired?: number
    maxAllowed?: number
    loading?: boolean
    error?: string | null
}

export default function GoalsSelector({
    selectedGoals,
    onGoalsChange,
    minRequired = 1,
    maxAllowed = 5,
    loading = false,
    error = null
}: GoalsSelectorProps) {
    const toggleGoal = (goalId: string) => {
        if (selectedGoals.includes(goalId)) {
            onGoalsChange(selectedGoals.filter(g => g !== goalId))
        } else if (selectedGoals.length < maxAllowed) {
            onGoalsChange([...selectedGoals, goalId])
        }
    }

    const isValid = selectedGoals.length >= minRequired

    return (
        <div className="space-y-4">
            <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                    What matters most to you?
                </h3>
                <p className="text-sm text-muted-foreground">
                    Select {minRequired === 1 ? 'at least 1 goal' : `${minRequired}-${maxAllowed} goals`} to personalize your experience
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {USER_GOALS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal.id)
                    const isDisabled = !isSelected && selectedGoals.length >= maxAllowed

                    return (
                        <button
                            key={goal.id}
                            type="button"
                            onClick={() => toggleGoal(goal.id)}
                            disabled={isDisabled || loading}
                            className={cn(
                                "relative group p-4 rounded-xl border-2 transition-all duration-200 text-left",
                                "hover:scale-[1.02] active:scale-[0.98]",
                                isSelected 
                                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" 
                                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                                isDisabled && "opacity-50 cursor-not-allowed hover:scale-100"
                            )}
                        >
                            {/* Selected indicator */}
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                    <Check className="h-4 w-4 text-primary-foreground" />
                                </div>
                            )}

                            {/* Icon */}
                            <div className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center mb-3 transition-colors",
                                isSelected 
                                    ? "bg-primary text-primary-foreground" 
                                    : "bg-white/10 text-muted-foreground group-hover:text-foreground"
                            )}>
                                {goal.icon}
                            </div>

                            {/* Label */}
                            <h4 className={cn(
                                "font-medium text-sm mb-1 transition-colors",
                                isSelected ? "text-primary" : "text-foreground"
                            )}>
                                {goal.label}
                            </h4>

                            {/* Description */}
                            <p className="text-xs text-muted-foreground line-clamp-2">
                                {goal.description}
                            </p>
                        </button>
                    )
                })}
            </div>

            {/* Selection count */}
            <div className="flex items-center justify-between text-sm">
                <span className={cn(
                    "transition-colors",
                    isValid ? "text-green-400" : "text-muted-foreground"
                )}>
                    {selectedGoals.length} of {maxAllowed} selected
                    {!isValid && ` (need ${minRequired - selectedGoals.length} more)`}
                </span>
                
                {selectedGoals.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onGoalsChange([])}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        disabled={loading}
                    >
                        Clear all
                    </button>
                )}
            </div>

            {error && (
                <div className="text-sm text-red-500 text-center p-2 bg-red-500/10 rounded-lg">
                    {error}
                </div>
            )}
        </div>
    )
}
