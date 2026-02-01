/**
 * Have I Been Pwned Integration
 * 
 * Checks if a user's email has appeared in known data breaches.
 * Uses the HIBP API v3 with k-anonymity model for password checking.
 * 
 * API Documentation: https://haveibeenpwned.com/API/v3
 */

import { createClient } from '@/utils/supabase/server'
import crypto from 'crypto'

const HIBP_API_BASE = 'https://haveibeenpwned.com/api/v3'

interface HIBPBreach {
    Name: string
    Title: string
    Domain: string
    BreachDate: string
    AddedDate: string
    ModifiedDate: string
    PwnCount: number
    Description: string
    DataClasses: string[]
    IsVerified: boolean
    IsFabricated: boolean
    IsSensitive: boolean
    IsRetired: boolean
    IsSpamList: boolean
    LogoPath: string
}

interface HIBPCheckResult {
    found: boolean
    breachCount: number
    breaches: HIBPBreach[]
    lastChecked: string
    criticalBreaches: HIBPBreach[]
    recentBreaches: HIBPBreach[]
    exposedDataTypes: string[]
}

/**
 * Check if an email has been in data breaches
 * 
 * Note: Requires HIBP API key for breach checks
 * Set HIBP_API_KEY in environment variables
 */
export async function checkEmailBreaches(
    email: string
): Promise<{
    success: boolean
    result?: HIBPCheckResult
    error?: string
}> {
    try {
        const apiKey = process.env.HIBP_API_KEY

        if (!apiKey) {
            console.warn('[HIBP] No API key configured - using mock data for development')
            return {
                success: true,
                result: getMockBreachData(email)
            }
        }

        const response = await fetch(
            `${HIBP_API_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
            {
                headers: {
                    'hibp-api-key': apiKey,
                    'user-agent': 'PolicyParser-BreachCheck'
                }
            }
        )

        // 404 means no breaches found (good!)
        if (response.status === 404) {
            return {
                success: true,
                result: {
                    found: false,
                    breachCount: 0,
                    breaches: [],
                    lastChecked: new Date().toISOString(),
                    criticalBreaches: [],
                    recentBreaches: [],
                    exposedDataTypes: []
                }
            }
        }

        if (!response.ok) {
            if (response.status === 429) {
                return { success: false, error: 'Rate limited - please try again later' }
            }
            throw new Error(`HIBP API error: ${response.status}`)
        }

        const breaches: HIBPBreach[] = await response.json()

        // Identify critical breaches (passwords, financial data)
        const criticalBreaches = breaches.filter(b => 
            b.DataClasses.some(dc => 
                ['Passwords', 'Credit cards', 'Bank account numbers', 'Financial data', 'Social security numbers'].includes(dc)
            ) && b.IsVerified && !b.IsRetired
        )

        // Identify recent breaches (within last year)
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        const recentBreaches = breaches.filter(b => 
            new Date(b.BreachDate) > oneYearAgo && b.IsVerified
        )

        // Get all exposed data types
        const exposedDataTypes = [...new Set(
            breaches.flatMap(b => b.DataClasses)
        )].sort()

        return {
            success: true,
            result: {
                found: true,
                breachCount: breaches.length,
                breaches,
                lastChecked: new Date().toISOString(),
                criticalBreaches,
                recentBreaches,
                exposedDataTypes
            }
        }

    } catch (error: any) {
        console.error('[HIBP] Check failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Check and update user's breach status
 */
export async function updateUserBreachStatus(
    userId: string,
    email: string
): Promise<{
    success: boolean
    result?: HIBPCheckResult
    error?: string
}> {
    try {
        const checkResult = await checkEmailBreaches(email)

        if (!checkResult.success) {
            return checkResult
        }

        const result = checkResult.result!

        // Update user profile with breach data
        const supabase = await createClient()

        await supabase
            .from('user_profiles')
            .update({
                hibp_checked_at: new Date().toISOString(),
                hibp_breach_count: result.breachCount,
                hibp_breaches: result.breaches.map(b => ({
                    Name: b.Name,
                    Title: b.Title,
                    BreachDate: b.BreachDate,
                    DataClasses: b.DataClasses,
                    IsVerified: b.IsVerified,
                    PwnCount: b.PwnCount
                }))
            })
            .eq('user_id', userId)

        return { success: true, result }

    } catch (error: any) {
        console.error('[HIBP] Update failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Check if a password has been compromised
 * Uses k-anonymity model - only sends first 5 chars of SHA-1 hash
 */
export async function checkPasswordCompromised(
    password: string
): Promise<{
    success: boolean
    compromised?: boolean
    occurrences?: number
    error?: string
}> {
    try {
        // Hash password with SHA-1
        const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
        const prefix = hash.substring(0, 5)
        const suffix = hash.substring(5)

        const response = await fetch(
            `https://api.pwnedpasswords.com/range/${prefix}`,
            {
                headers: {
                    'user-agent': 'PolicyParser-PasswordCheck'
                }
            }
        )

        if (!response.ok) {
            throw new Error(`Pwned Passwords API error: ${response.status}`)
        }

        const text = await response.text()
        const lines = text.split('\n')

        for (const line of lines) {
            const [hashSuffix, count] = line.split(':')
            if (hashSuffix.trim() === suffix) {
                return {
                    success: true,
                    compromised: true,
                    occurrences: parseInt(count.trim(), 10)
                }
            }
        }

        return {
            success: true,
            compromised: false,
            occurrences: 0
        }

    } catch (error: any) {
        console.error('[HIBP] Password check failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Get breach statistics for dashboard display
 */
export async function getBreachStats(
    userId: string
): Promise<{
    success: boolean
    stats?: {
        totalBreaches: number
        criticalBreaches: number
        recentBreaches: number
        lastChecked: string | null
        topExposedData: string[]
        riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    }
    error?: string
}> {
    try {
        const supabase = await createClient()

        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('hibp_checked_at, hibp_breach_count, hibp_breaches')
            .eq('user_id', userId)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        if (!profile || !profile.hibp_checked_at) {
            return {
                success: true,
                stats: {
                    totalBreaches: 0,
                    criticalBreaches: 0,
                    recentBreaches: 0,
                    lastChecked: null,
                    topExposedData: [],
                    riskLevel: 'SAFE'
                }
            }
        }

        const breaches = (profile.hibp_breaches as any[]) || []
        
        // Count critical breaches
        const criticalBreaches = breaches.filter(b => 
            b.DataClasses?.some((dc: string) => 
                ['Passwords', 'Credit cards', 'Bank account numbers'].includes(dc)
            ) && b.IsVerified
        ).length

        // Count recent breaches
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        const recentBreaches = breaches.filter(b => 
            new Date(b.BreachDate) > oneYearAgo
        ).length

        // Get top exposed data types
        const dataTypeCounts: Record<string, number> = {}
        for (const breach of breaches) {
            for (const dataType of breach.DataClasses || []) {
                dataTypeCounts[dataType] = (dataTypeCounts[dataType] || 0) + 1
            }
        }
        const topExposedData = Object.entries(dataTypeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type]) => type)

        // Determine risk level
        let riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'SAFE'
        if (profile.hibp_breach_count === 0) riskLevel = 'SAFE'
        else if (criticalBreaches > 2 || profile.hibp_breach_count > 10) riskLevel = 'CRITICAL'
        else if (criticalBreaches > 0 || profile.hibp_breach_count > 5) riskLevel = 'HIGH'
        else if (recentBreaches > 0 || profile.hibp_breach_count > 2) riskLevel = 'MEDIUM'
        else riskLevel = 'LOW'

        return {
            success: true,
            stats: {
                totalBreaches: profile.hibp_breach_count || 0,
                criticalBreaches,
                recentBreaches,
                lastChecked: profile.hibp_checked_at,
                topExposedData,
                riskLevel
            }
        }

    } catch (error: any) {
        console.error('[HIBP] Stats fetch failed:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Mock breach data for development/testing
 */
function getMockBreachData(email: string): HIBPCheckResult {
    // Return empty for most emails, mock data for specific test email
    if (email.includes('test') || email.includes('demo')) {
        return {
            found: true,
            breachCount: 3,
            breaches: [
                {
                    Name: 'LinkedIn',
                    Title: 'LinkedIn',
                    Domain: 'linkedin.com',
                    BreachDate: '2021-06-22',
                    AddedDate: '2021-06-29',
                    ModifiedDate: '2021-06-29',
                    PwnCount: 700000000,
                    Description: 'LinkedIn data breach affecting 700 million users',
                    DataClasses: ['Email addresses', 'Phone numbers', 'Names', 'Professional details'],
                    IsVerified: true,
                    IsFabricated: false,
                    IsSensitive: false,
                    IsRetired: false,
                    IsSpamList: false,
                    LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/LinkedIn.png'
                },
                {
                    Name: 'Adobe',
                    Title: 'Adobe',
                    Domain: 'adobe.com',
                    BreachDate: '2013-10-04',
                    AddedDate: '2013-12-04',
                    ModifiedDate: '2022-05-15',
                    PwnCount: 152000000,
                    Description: 'Adobe data breach exposing user credentials',
                    DataClasses: ['Email addresses', 'Passwords', 'Password hints'],
                    IsVerified: true,
                    IsFabricated: false,
                    IsSensitive: false,
                    IsRetired: false,
                    IsSpamList: false,
                    LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/Adobe.png'
                },
                {
                    Name: 'Dropbox',
                    Title: 'Dropbox',
                    Domain: 'dropbox.com',
                    BreachDate: '2012-07-01',
                    AddedDate: '2016-08-31',
                    ModifiedDate: '2016-08-31',
                    PwnCount: 68000000,
                    Description: 'Dropbox data breach from 2012',
                    DataClasses: ['Email addresses', 'Passwords'],
                    IsVerified: true,
                    IsFabricated: false,
                    IsSensitive: false,
                    IsRetired: false,
                    IsSpamList: false,
                    LogoPath: 'https://haveibeenpwned.com/Content/Images/PwnedLogos/Dropbox.png'
                }
            ],
            lastChecked: new Date().toISOString(),
            criticalBreaches: [
                {
                    Name: 'Adobe',
                    Title: 'Adobe',
                    Domain: 'adobe.com',
                    BreachDate: '2013-10-04',
                    AddedDate: '2013-12-04',
                    ModifiedDate: '2022-05-15',
                    PwnCount: 152000000,
                    Description: 'Adobe data breach exposing user credentials',
                    DataClasses: ['Email addresses', 'Passwords', 'Password hints'],
                    IsVerified: true,
                    IsFabricated: false,
                    IsSensitive: false,
                    IsRetired: false,
                    IsSpamList: false,
                    LogoPath: ''
                }
            ],
            recentBreaches: [],
            exposedDataTypes: ['Email addresses', 'Passwords', 'Phone numbers', 'Names', 'Professional details', 'Password hints']
        }
    }

    return {
        found: false,
        breachCount: 0,
        breaches: [],
        lastChecked: new Date().toISOString(),
        criticalBreaches: [],
        recentBreaches: [],
        exposedDataTypes: []
    }
}
