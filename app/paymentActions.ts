"use server";

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function upgradeToPro() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "User not logged in" };
    }

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Update user profile to Pro (upsert to ensure row exists)
    const { error, data } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            is_pro: true,
            updated_at: new Date().toISOString()
        })
        .select();

    if (error) {
        console.error("Failed to upgrade user:", error);
        return { success: false, error: "Failed to update subscription status. DB Error: " + error.message };
    }

    if (!data || data.length === 0) {
        console.error("No profile row updated/inserted. User ID:", user.id);
        return { success: false, error: "Profile update failed. No data returned." };
    }

    revalidatePath('/', 'layout'); // Clear all cache

    return { success: true };
}
