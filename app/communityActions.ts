"use server";

import { createClient } from '@/utils/supabase/server';

export async function submitCommunityScore(domain: string, score: number) {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "You must be logged in to vote." };
    }

    // Validate score
    if (score < 0 || score > 100) {
        return { success: false, error: "Score must be between 0 and 100." };
    }

    // Insert or update vote (upsert on unique constraint user_id, domain)
    const { error } = await supabase
        .from('community_scores')
        .upsert({
            user_id: user.id,
            domain,
            score
        }, {
            onConflict: 'user_id,domain'
        });

    if (error) {
        console.error("Error submitting community score:", error);
        return { success: false, error: "Failed to submit vote." };
    }

    // Fetch updated average
    const avgResult = await getCommunityScore(domain);

    return { success: true, ...avgResult };
}

export async function getCommunityScore(domain: string) {
    const supabase = await createClient();

    // Get average score and count
    const { data, error } = await supabase
        .from('community_scores')
        .select('score')
        .eq('domain', domain);

    if (error || !data || data.length === 0) {
        return { averageScore: null, voteCount: 0 };
    }

    const totalScore = data.reduce((sum, row) => sum + row.score, 0);
    const averageScore = Math.round(totalScore / data.length);

    return { averageScore, voteCount: data.length };
}

export async function getUserVote(domain: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { userScore: null };
    }

    const { data } = await supabase
        .from('community_scores')
        .select('score')
        .eq('user_id', user.id)
        .eq('domain', domain)
        .single();

    return { userScore: data?.score || null };
}
