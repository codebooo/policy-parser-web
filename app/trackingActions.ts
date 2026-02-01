"use server";

import { createClient } from '@/utils/supabase/server';
import { analyzeDomainInternal } from './actions';
import crypto from 'crypto';

// Generate a hash of the policy content for change detection
function generatePolicyHash(content: string): string {
    // Normalize the content before hashing
    const normalized = content
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

export interface TrackedPolicy {
    id: string;
    user_id: string;
    domain: string;
    policy_url: string | null;
    policy_hash: string | null;
    last_checked: string;
    last_analysis: any | null;
    has_changes: boolean;
    previous_analysis: any | null;
    created_at: string;
}

export interface PolicyChange {
    domain: string;
    policy_url: string;
    detected_at: string;
    change_type: 'new_policy' | 'content_changed' | 'score_changed';
    old_score: number | null;
    new_score: number | null;
    summary: string;
}

export async function trackPolicy(domain: string, policyUrl?: string, initialAnalysis?: any) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
        console.error("Auth error in trackPolicy:", authError);
        return { success: false, error: "Authentication error: " + authError.message };
    }

    if (!user) return { success: false, error: "Must be logged in to track policies" };

    // Check if already tracked
    const { data: existing, error: checkError } = await supabase
        .from('tracked_policies')
        .select('id')
        .eq('user_id', user.id)
        .eq('domain', domain)
        .single();

    if (checkError && checkError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which is expected
        console.error("Check existing error:", checkError);
    }

    if (existing) return { success: true, message: "Already tracking" };

    // Generate hash from initial analysis if available
    const policyHash = initialAnalysis?.rawPolicyText 
        ? generatePolicyHash(initialAnalysis.rawPolicyText)
        : null;

    // Prepare a slimmed-down analysis to avoid storage issues
    // Remove the rawPolicyText from stored analysis as it's often very large
    let storedAnalysis = null;
    if (initialAnalysis) {
        const { rawPolicyText, ...analysisWithoutText } = initialAnalysis;
        storedAnalysis = analysisWithoutText;
    }

    const insertData = {
        user_id: user.id,
        domain,
        policy_url: policyUrl || null,
        policy_hash: policyHash,
        last_checked: new Date().toISOString(),
        last_analysis: storedAnalysis,
        has_changes: false,
        previous_analysis: null
    };

    console.log("Inserting tracked policy:", { domain, policyUrl, hasAnalysis: !!storedAnalysis });

    const { error } = await supabase
        .from('tracked_policies')
        .insert(insertData);

    if (error) {
        console.error("Track error details:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
        });
        return { success: false, error: `Failed to track policy: ${error.message}` };
    }

    return { success: true };
}

export async function untrackPolicy(domain: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, error: "Must be logged in" };

    const { error } = await supabase
        .from('tracked_policies')
        .delete()
        .eq('user_id', user.id)
        .eq('domain', domain);

    if (error) return { success: false, error: "Failed to untrack" };

    return { success: true };
}

export async function getTrackedPolicies(): Promise<TrackedPolicy[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data } = await supabase
        .from('tracked_policies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    return (data as TrackedPolicy[]) || [];
}

export async function getTrackedPolicyWithChanges(domain: string): Promise<{
    policy: TrackedPolicy | null;
    hasChanges: boolean;
    changes: PolicyChange | null;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { policy: null, hasChanges: false, changes: null };

    const { data } = await supabase
        .from('tracked_policies')
        .select('*')
        .eq('user_id', user.id)
        .eq('domain', domain)
        .single();

    if (!data) return { policy: null, hasChanges: false, changes: null };

    const policy = data as TrackedPolicy;
    
    if (policy.has_changes && policy.previous_analysis && policy.last_analysis) {
        const changes: PolicyChange = {
            domain: policy.domain,
            policy_url: policy.policy_url || '',
            detected_at: policy.last_checked,
            change_type: policy.previous_analysis.score !== policy.last_analysis.score 
                ? 'score_changed' 
                : 'content_changed',
            old_score: policy.previous_analysis.score || null,
            new_score: policy.last_analysis.score || null,
            summary: generateChangeSummary(policy.previous_analysis, policy.last_analysis)
        };
        return { policy, hasChanges: true, changes };
    }

    return { policy, hasChanges: false, changes: null };
}

function generateChangeSummary(oldAnalysis: any, newAnalysis: any): string {
    const summaryParts: string[] = [];
    
    if (oldAnalysis.score !== newAnalysis.score) {
        const diff = newAnalysis.score - oldAnalysis.score;
        summaryParts.push(`Score ${diff > 0 ? 'improved' : 'decreased'} by ${Math.abs(diff)} points (${oldAnalysis.score} → ${newAnalysis.score})`);
    }

    const oldThreats = oldAnalysis.key_findings?.filter((f: any) => 
        (typeof f === 'object' && f.category === 'THREAT') || 
        (typeof f === 'string' && f.toLowerCase().includes('threat'))
    ).length || 0;
    
    const newThreats = newAnalysis.key_findings?.filter((f: any) => 
        (typeof f === 'object' && f.category === 'THREAT') || 
        (typeof f === 'string' && f.toLowerCase().includes('threat'))
    ).length || 0;

    if (oldThreats !== newThreats) {
        if (newThreats > oldThreats) {
            summaryParts.push(`${newThreats - oldThreats} new threat(s) detected`);
        } else {
            summaryParts.push(`${oldThreats - newThreats} threat(s) resolved`);
        }
    }

    if (summaryParts.length === 0) {
        summaryParts.push('Policy content has been updated');
    }

    return summaryParts.join('. ');
}

export async function markChangesAsViewed(domain: string): Promise<{ success: boolean }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false };

    const { error } = await supabase
        .from('tracked_policies')
        .update({ 
            has_changes: false,
            previous_analysis: null 
        })
        .eq('user_id', user.id)
        .eq('domain', domain);

    return { success: !error };
}

/**
 * Check a single tracked policy for updates
 */
export async function checkSinglePolicyForUpdates(domain: string): Promise<{
    success: boolean;
    hasChanges: boolean;
    error?: string;
    newAnalysis?: any;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { success: false, hasChanges: false, error: "Must be logged in" };

    // Get the tracked policy
    const { data: policy } = await supabase
        .from('tracked_policies')
        .select('*')
        .eq('user_id', user.id)
        .eq('domain', domain)
        .single();

    if (!policy) return { success: false, hasChanges: false, error: "Policy not found" };

    try {
        // Re-analyze the domain using internal (non-streaming) function
        const result = await analyzeDomainInternal(domain);
        
        if (!result.success || !result.data) {
            return { success: false, hasChanges: false, error: result.error || "Analysis failed" };
        }

        const newAnalysis = result.data;

        // Check if content has changed
        const newHash = newAnalysis.rawPolicyText 
            ? generatePolicyHash(newAnalysis.rawPolicyText)
            : null;
        
        const hasChanges = policy.policy_hash !== newHash || 
            policy.last_analysis?.score !== newAnalysis.score;

        // Update the tracked policy
        await supabase
            .from('tracked_policies')
            .update({
                last_checked: new Date().toISOString(),
                policy_hash: newHash,
                policy_url: newAnalysis.url || policy.policy_url,
                previous_analysis: hasChanges ? policy.last_analysis : null,
                last_analysis: newAnalysis,
                has_changes: hasChanges
            })
            .eq('user_id', user.id)
            .eq('domain', domain);

        return { success: true, hasChanges, newAnalysis };
    } catch (e: any) {
        console.error("Check policy failed:", e);
        return { success: false, hasChanges: false, error: e?.message || "Unknown error" };
    }
}

/**
 * Check all tracked policies for updates.
 */
export async function checkTrackedPoliciesForUpdates(): Promise<{ 
    success: boolean; 
    updates?: { domain: string; hasChanges: boolean; newScore?: number; oldScore?: number }[]; 
    error?: string 
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "Must be logged in" };
    }

    // Get all tracked policies for this user
    const { data: policies, error } = await supabase
        .from('tracked_policies')
        .select('*')
        .eq('user_id', user.id);

    if (error) {
        return { success: false, error: "Failed to fetch tracked policies" };
    }

    if (!policies || policies.length === 0) {
        return { success: true, updates: [] };
    }

    const updates: { domain: string; hasChanges: boolean; newScore?: number; oldScore?: number }[] = [];

    // Check each policy (with rate limiting)
    for (const policy of policies) {
        try {
            const result = await checkSinglePolicyForUpdates(policy.domain);
            updates.push({
                domain: policy.domain,
                hasChanges: result.hasChanges,
                newScore: result.newAnalysis?.score,
                oldScore: policy.last_analysis?.score
            });
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.error(`Failed to check ${policy.domain}:`, e);
            updates.push({ domain: policy.domain, hasChanges: false });
        }
    }

    return { success: true, updates };
}

/**
 * Get notifications count (policies with changes)
 */
export async function getNotificationsCount(): Promise<number> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return 0;

    const { count } = await supabase
        .from('tracked_policies')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('has_changes', true);

    return count || 0;
}

/**
 * Get all policies with changes (notifications)
 */
export async function getPoliciesWithChanges(): Promise<TrackedPolicy[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data } = await supabase
        .from('tracked_policies')
        .select('*')
        .eq('user_id', user.id)
        .eq('has_changes', true)
        .order('last_checked', { ascending: false });

    return (data as TrackedPolicy[]) || [];
}
