/**
 * Personal Risk Score Calculator
 * 
 * Calculates a personalized privacy risk score based on:
 * - User's analyzed services and their scores
 * - Data breach exposure (Have I Been Pwned)
 * - User's region/jurisdiction
 * - User's privacy goals and concerns
 * - Number of services with concerning practices
 */

import { createClient } from '@/utils/supabase/server'

export interface RiskFactors {
    analyzedServicesScore: number      // Average score of analyzed services (0-100)
    breachExposure: number             // Number of known data breaches
    concerningServicesCount: number    // Services with score < 50
    highRiskServicesCount: number      // Services with score < 30
    regionRisk: number                 // Risk based on jurisdiction (0-100)
    dataExposureIndex: number          // How much data is at risk
}

export interface PersonalRiskProfile {
    overallScore: number               // 0-100 (higher = better/safer)
    riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
    factors: RiskFactors
    recommendations: string[]
    topConcerns: Array<{
        domain: string
        score: number
        mainConcern: string
    }>
    breachSummary?: {
        total: number
        critical: number
        recent: number
        exposedData: string[]
    }
}

// Region risk scores (lower = more protection, higher score needed)
const REGION_RISK_SCORES: Record<string, number> = {
    'EU': 20,        // GDPR provides strong protections
    'UK': 25,        // UK GDPR post-Brexit
    'US_CA': 35,     // CCPA/CPRA provides some protections
    'CA': 30,        // PIPEDA
    'AU': 40,        // Privacy Act 1988
    'BR': 35,        // LGPD
    'US_OTHER': 60,  // Limited federal protections
    'OTHER': 50      // Default - varies
}

/**
 * Calculate personal risk score for a user
 */
export async function calculatePersonalRiskScore(
    userId: string
): Promise<{
    success: boolean
    profile?: PersonalRiskProfile
    error?: string
}> {
    try {
        const supabase = await createClient()

        // Get user profile
        const { data: userProfile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (profileError && profileError.code !== 'PGRST116') {
            throw profileError
        }

        // Get user's analyzed services
        const { data: analyzedServices, error: servicesError } = await supabase
            .from('user_analyzed_services')
            .select(`
                domain,
                latest_score,
                latest_version_id,
                is_favorite,
                first_analyzed_at,
                analysis_count
            `)
            .eq('user_id', userId)

        if (servicesError) throw servicesError

        // Get full analysis data for top concerns
        const concerningServices = (analyzedServices || [])
            .filter(s => s.latest_score !== null && s.latest_score < 50)
            .sort((a, b) => (a.latest_score || 100) - (b.latest_score || 100))
            .slice(0, 5)

        // Fetch analysis details for concerning services
        const topConcerns: Array<{ domain: string; score: number; mainConcern: string }> = []

        for (const service of concerningServices) {
            if (service.latest_version_id) {
                const { data: version } = await supabase
                    .from('policy_versions')
                    .select('analysis_data')
                    .eq('id', service.latest_version_id)
                    .single()

                const analysisData = version?.analysis_data as any
                const concerns = analysisData?.key_findings?.filter(
                    (f: any) => f.category === 'CONCERNING' || f.category === 'THREAT'
                ) || []

                topConcerns.push({
                    domain: service.domain,
                    score: service.latest_score || 0,
                    mainConcern: concerns[0]?.text || 'Low privacy score'
                })
            }
        }

        // Calculate factors
        const services = analyzedServices || []
        const scores = services.map(s => s.latest_score).filter(s => s !== null) as number[]
        
        const avgScore = scores.length > 0 
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
            : 100

        const concerningCount = scores.filter(s => s < 50).length
        const highRiskCount = scores.filter(s => s < 30).length

        const regionRisk = REGION_RISK_SCORES[userProfile?.region || 'OTHER'] || 50

        // Calculate breach exposure
        const breachCount = userProfile?.hibp_breach_count || 0
        const breachExposure = Math.min(breachCount * 10, 100) // Cap at 100

        // Calculate data exposure index (based on number of services × risk)
        const dataExposureIndex = Math.min(
            Math.round(
                (services.length * 5) + 
                (concerningCount * 15) + 
                (highRiskCount * 25)
            ),
            100
        )

        const factors: RiskFactors = {
            analyzedServicesScore: avgScore,
            breachExposure: breachCount,
            concerningServicesCount: concerningCount,
            highRiskServicesCount: highRiskCount,
            regionRisk,
            dataExposureIndex
        }

        // Calculate overall score (weighted average)
        // Higher score = safer
        const overallScore = Math.round(
            (avgScore * 0.35) +                           // 35% - average service score
            ((100 - breachExposure) * 0.20) +             // 20% - breach exposure (inverted)
            ((100 - regionRisk) * 0.10) +                 // 10% - region protection
            ((100 - dataExposureIndex) * 0.20) +          // 20% - data exposure
            (Math.max(0, 100 - concerningCount * 10) * 0.15) // 15% - concerning services
        )

        // Determine risk level
        let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
        if (overallScore >= 75) riskLevel = 'LOW'
        else if (overallScore >= 50) riskLevel = 'MODERATE'
        else if (overallScore >= 25) riskLevel = 'HIGH'
        else riskLevel = 'CRITICAL'

        // Generate recommendations based on factors
        const recommendations = generateRecommendations(factors, userProfile)

        // Parse breach summary
        const breachSummary = breachCount > 0 ? {
            total: breachCount,
            critical: (userProfile?.hibp_breaches as any[])?.filter(
                b => b.DataClasses?.includes('Passwords') || b.DataClasses?.includes('Credit cards')
            ).length || 0,
            recent: (userProfile?.hibp_breaches as any[])?.filter(
                b => new Date(b.BreachDate) > new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            ).length || 0,
            exposedData: [...new Set(
                (userProfile?.hibp_breaches as any[])?.flatMap(b => b.DataClasses || []) || []
            )].slice(0, 10)
        } : undefined

        const profile: PersonalRiskProfile = {
            overallScore,
            riskLevel,
            factors,
            recommendations,
            topConcerns,
            breachSummary
        }

        // Update user profile with calculated score
        if (userProfile) {
            await supabase
                .from('user_profiles')
                .update({
                    personal_risk_score: overallScore,
                    last_risk_calculation: new Date().toISOString()
                })
                .eq('user_id', userId)
        }

        return { success: true, profile }

    } catch (error: any) {
        console.error('[RiskScore] Calculation failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Generate personalized recommendations based on risk factors
 */
function generateRecommendations(
    factors: RiskFactors,
    userProfile: any
): string[] {
    const recommendations: string[] = []

    // Breach-related recommendations
    if (factors.breachExposure > 0) {
        recommendations.push(
            `🔴 Your email appears in ${factors.breachExposure} data breach${factors.breachExposure > 1 ? 'es' : ''}. Change passwords for affected accounts and enable 2FA.`
        )
    }

    // High-risk services
    if (factors.highRiskServicesCount > 0) {
        recommendations.push(
            `⚠️ You use ${factors.highRiskServicesCount} service${factors.highRiskServicesCount > 1 ? 's' : ''} with critical privacy concerns. Consider alternatives or limit data shared.`
        )
    }

    // Concerning services
    if (factors.concerningServicesCount > 2) {
        recommendations.push(
            `📊 ${factors.concerningServicesCount} of your services score below 50. Review which services truly need your data.`
        )
    }

    // Region-specific recommendations
    const region = userProfile?.region
    if (region === 'EU') {
        recommendations.push(
            `🇪🇺 Under GDPR, you have the right to request data deletion and portability from all services.`
        )
    } else if (region === 'US_CA') {
        recommendations.push(
            `🇺🇸 California residents can opt-out of data sales. Look for "Do Not Sell My Personal Information" links.`
        )
    } else if (region === 'US_OTHER') {
        recommendations.push(
            `📋 Your state may have limited privacy laws. Consider using privacy-focused service alternatives.`
        )
    }

    // Goal-specific recommendations
    const goals = userProfile?.goals || []
    if (goals.includes('protect_family')) {
        recommendations.push(
            `👨‍👩‍👧‍👦 Enable parental controls and review privacy settings on services your children use.`
        )
    }
    if (goals.includes('limit_tracking')) {
        recommendations.push(
            `🛡️ Use a privacy-focused browser and consider a VPN to limit cross-site tracking.`
        )
    }
    if (goals.includes('avoid_data_selling')) {
        recommendations.push(
            `💰 Opt-out of data sharing on each service's privacy settings page when available.`
        )
    }

    // Data exposure recommendations
    if (factors.dataExposureIndex > 50) {
        recommendations.push(
            `📉 Your data exposure is high. Consider deleting accounts you no longer use.`
        )
    }

    // Generic good practices
    if (recommendations.length < 5) {
        recommendations.push(
            `✅ Enable two-factor authentication on all important accounts.`
        )
    }

    return recommendations.slice(0, 6)
}

/**
 * Track when a user analyzes a service
 */
export async function trackUserAnalysis(
    userId: string,
    domain: string,
    score: number,
    versionId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()

        await supabase
            .from('user_analyzed_services')
            .upsert({
                user_id: userId,
                domain,
                latest_score: score,
                latest_version_id: versionId,
                last_analyzed_at: new Date().toISOString(),
                analysis_count: 1 // Will be incremented by trigger or manual update
            }, {
                onConflict: 'user_id,domain'
            })

        // Increment analysis count for existing records
        await supabase.rpc('increment_analysis_count', {
            p_user_id: userId,
            p_domain: domain
        })

        return { success: true }

    } catch (error: any) {
        console.error('[RiskScore] Track analysis failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get user's data exposure map (which services have which data)
 */
export async function getDataExposureMap(
    userId: string
): Promise<{
    success: boolean
    exposureMap?: Record<string, string[]>
    error?: string
}> {
    try {
        const supabase = await createClient()

        const { data: services, error } = await supabase
            .from('user_analyzed_services')
            .select(`
                domain,
                latest_version_id
            `)
            .eq('user_id', userId)

        if (error) throw error

        const exposureMap: Record<string, string[]> = {}

        for (const service of services || []) {
            if (service.latest_version_id) {
                const { data: version } = await supabase
                    .from('policy_versions')
                    .select('analysis_data')
                    .eq('id', service.latest_version_id)
                    .single()

                const analysisData = version?.analysis_data as any
                const dataCollected = analysisData?.data_collected || []

                for (const dataType of dataCollected) {
                    if (!exposureMap[dataType]) {
                        exposureMap[dataType] = []
                    }
                    exposureMap[dataType].push(service.domain)
                }
            }
        }

        return { success: true, exposureMap }

    } catch (error: any) {
        console.error('[RiskScore] Exposure map failed:', error)
        return { success: false, error: error.message }
    }
}
