/**
 * AI-Powered Policy Changelog Generator
 * 
 * Generates human-readable changelogs when policies are updated,
 * classifying changes as WORSE, BETTER, or NEUTRAL with severity ratings.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { getGeminiModel } from '@/app/lib/ai/gemini'
import { createClient } from '@/utils/supabase/server'

// Schema for individual changelog items
const ChangelogItemSchema = z.object({
    type: z.enum(['WORSE', 'BETTER', 'NEUTRAL']),
    severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
    category: z.string().describe('Category of the change: data_collection, third_party_sharing, user_rights, retention, security, tracking, ai_training, etc.'),
    title: z.string().describe('Short title summarizing the change'),
    description: z.string().describe('Detailed explanation of what changed'),
    old_text: z.string().optional().describe('Quote from old policy (if applicable)'),
    new_text: z.string().optional().describe('Quote from new policy (if applicable)'),
    user_impact: z.string().describe('Plain English explanation of how this affects users')
})

// Full changelog response schema
const ChangelogResponseSchema = z.object({
    summary: z.string().describe('2-3 sentence executive summary of all changes'),
    overall_verdict: z.enum(['SIGNIFICANTLY_WORSE', 'SOMEWHAT_WORSE', 'MINIMAL_CHANGE', 'SOMEWHAT_BETTER', 'SIGNIFICANTLY_BETTER']),
    changes: z.array(ChangelogItemSchema),
    key_concerns: z.array(z.string()).describe('Top 3 concerns users should know about'),
    positive_changes: z.array(z.string()).describe('Any improvements in the new policy'),
    action_items: z.array(z.string()).describe('Recommended actions for users to take')
})

export type ChangelogItem = z.infer<typeof ChangelogItemSchema>
export type ChangelogResponse = z.infer<typeof ChangelogResponseSchema>

const CHANGELOG_SYSTEM_PROMPT = `You are a privacy policy change analyst. Your job is to compare two versions of a privacy policy and generate a clear, actionable changelog that helps users understand what changed and how it affects them.

## CRITICAL RULES:

1. **CLASSIFY CHANGES ACCURATELY**:
   - WORSE: Changes that reduce user privacy, add data collection, or expand sharing
   - BETTER: Changes that improve user privacy, reduce data collection, or limit sharing
   - NEUTRAL: Clarifications, rewording, or changes that don't affect privacy

2. **SEVERITY RATINGS**:
   - CRITICAL 🔴: Major privacy concerns (selling data, AI training additions, biometric collection, sharing with government)
   - HIGH 🟠: Significant concerns (new third-party sharing, expanded tracking, removed user rights)
   - MEDIUM 🟡: Moderate concerns (extended retention, new data categories, vague language added)
   - LOW 🔵: Minor concerns (cosmetic changes, clarifications that slightly expand scope)

3. **BE SPECIFIC**: Always quote the relevant text from both policies when possible.

4. **USER-FOCUSED**: Explain impacts in plain language - what does this mean for everyday users?

5. **AI TRAINING DETECTION**: Pay special attention to:
   - New mentions of "machine learning", "AI", "train models", "improve our services through AI"
   - Changes to how user content/data is used for product development
   - These should be marked CRITICAL if they allow AI training on user data

6. **DATA SELLING DETECTION**: Watch for:
   - New "share with partners for marketing purposes"
   - Removal of "we don't sell your data" commitments
   - Added "data monetization" or "business purposes" language

7. **OUTPUT IN ENGLISH ONLY**: All output must be in English. Translate any foreign text.
`

const CHANGELOG_USER_PROMPT = (oldPolicy: string, newPolicy: string, domain: string) => `
Analyze the privacy policy changes for ${domain}.

## OLD POLICY VERSION:
${oldPolicy.substring(0, 50000)}

## NEW POLICY VERSION:
${newPolicy.substring(0, 50000)}

Generate a comprehensive changelog identifying ALL meaningful changes between these two versions.
Focus on:
1. New data collection practices
2. Changes to third-party sharing
3. User rights modifications
4. Retention period changes
5. AI/ML training provisions
6. Security practice changes
7. Cookie/tracking changes
8. Children's privacy changes
9. International transfer changes
10. Opt-out/consent changes

Be thorough but prioritize the most impactful changes. Output valid JSON only.
`

/**
 * Generate AI-powered changelog between two policy versions
 */
export async function generatePolicyChangelog(
    oldPolicyText: string,
    newPolicyText: string,
    domain: string,
    oldVersionId?: string,
    newVersionId?: string
): Promise<{
    success: boolean
    changelog?: ChangelogResponse
    error?: string
}> {
    try {
        console.log(`[Changelog] Generating changelog for ${domain}`)

        const { object: changelog } = await generateObject({
            model: getGeminiModel(),
            system: CHANGELOG_SYSTEM_PROMPT,
            prompt: CHANGELOG_USER_PROMPT(oldPolicyText, newPolicyText, domain),
            schema: ChangelogResponseSchema,
            mode: 'json'
        })

        // Calculate statistics
        const stats = {
            additions: changelog.changes.filter(c => c.type === 'WORSE').length,
            removals: changelog.changes.filter(c => c.type === 'BETTER').length,
            modifications: changelog.changes.filter(c => c.type === 'NEUTRAL').length
        }

        // Determine overall severity
        const criticalCount = changelog.changes.filter(c => c.severity === 'CRITICAL').length
        const highCount = changelog.changes.filter(c => c.severity === 'HIGH').length
        
        let overallSeverity = 'LOW'
        if (criticalCount > 0) overallSeverity = 'CRITICAL'
        else if (highCount > 0) overallSeverity = 'HIGH'
        else if (changelog.changes.some(c => c.severity === 'MEDIUM')) overallSeverity = 'MEDIUM'

        // Save to database if version IDs provided
        if (oldVersionId && newVersionId) {
            await saveChangelogToDatabase({
                domain,
                oldVersionId,
                newVersionId,
                changelog,
                stats,
                overallSeverity
            })
        }

        console.log(`[Changelog] Generated ${changelog.changes.length} changes (${overallSeverity} severity)`)

        return {
            success: true,
            changelog
        }

    } catch (error: any) {
        console.error('[Changelog] Generation failed:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * Save changelog to database for future reference
 */
async function saveChangelogToDatabase({
    domain,
    oldVersionId,
    newVersionId,
    changelog,
    stats,
    overallSeverity
}: {
    domain: string
    oldVersionId: string
    newVersionId: string
    changelog: ChangelogResponse
    stats: { additions: number; removals: number; modifications: number }
    overallSeverity: string
}) {
    try {
        const supabase = await createClient()

        // Get scores from versions
        const { data: oldVersion } = await supabase
            .from('policy_versions')
            .select('score')
            .eq('id', oldVersionId)
            .single()

        const { data: newVersion } = await supabase
            .from('policy_versions')
            .select('score')
            .eq('id', newVersionId)
            .single()

        const oldScore = oldVersion?.score || 0
        const newScore = newVersion?.score || 0

        const { error } = await supabase
            .from('policy_changelogs')
            .upsert({
                domain,
                policy_type: 'privacy',
                old_version_id: oldVersionId,
                new_version_id: newVersionId,
                old_score: oldScore,
                new_score: newScore,
                score_change: newScore - oldScore,
                changelog_summary: changelog.summary,
                changelog_items: changelog.changes,
                overall_severity: overallSeverity,
                additions_count: stats.additions,
                removals_count: stats.removals,
                modifications_count: stats.modifications,
                detected_at: new Date().toISOString()
            }, {
                onConflict: 'domain,policy_type,old_version_id,new_version_id'
            })

        if (error) {
            console.error('[Changelog] Failed to save to database:', error)
        }
    } catch (error) {
        console.error('[Changelog] Database save error:', error)
    }
}

/**
 * Get changelog for a specific policy change
 */
export async function getChangelogForVersions(
    oldVersionId: string,
    newVersionId: string
): Promise<{
    success: boolean
    changelog?: any
    error?: string
}> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('policy_changelogs')
            .select('*')
            .eq('old_version_id', oldVersionId)
            .eq('new_version_id', newVersionId)
            .single()

        if (error && error.code !== 'PGRST116') {
            throw error
        }

        if (!data) {
            return {
                success: false,
                error: 'Changelog not found'
            }
        }

        return {
            success: true,
            changelog: {
                ...data,
                changes: data.changelog_items
            }
        }

    } catch (error: any) {
        console.error('[Changelog] Fetch failed:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * Get recent changelogs for a domain
 */
export async function getRecentChangelogs(
    domain: string,
    limit: number = 10
): Promise<{
    success: boolean
    changelogs?: any[]
    error?: string
}> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('policy_changelogs')
            .select('*')
            .eq('domain', domain)
            .order('detected_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return {
            success: true,
            changelogs: data || []
        }

    } catch (error: any) {
        console.error('[Changelog] Fetch recent failed:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * Get critical changelogs across all tracked policies for a user
 */
export async function getCriticalChanges(
    userId: string
): Promise<{
    success: boolean
    changes?: any[]
    error?: string
}> {
    try {
        const supabase = await createClient()

        // Get user's tracked policies
        const { data: trackedPolicies, error: trackedError } = await supabase
            .from('tracked_policies')
            .select('domain')
            .eq('user_id', userId)

        if (trackedError) throw trackedError

        if (!trackedPolicies || trackedPolicies.length === 0) {
            return { success: true, changes: [] }
        }

        const domains = trackedPolicies.map(p => p.domain)

        // Get critical changelogs for tracked domains
        const { data: changelogs, error } = await supabase
            .from('policy_changelogs')
            .select('*')
            .in('domain', domains)
            .in('overall_severity', ['CRITICAL', 'HIGH'])
            .order('detected_at', { ascending: false })
            .limit(20)

        if (error) throw error

        return {
            success: true,
            changes: changelogs || []
        }

    } catch (error: any) {
        console.error('[Changelog] Critical changes fetch failed:', error)
        return {
            success: false,
            error: error.message
        }
    }
}
