"use server";

import { createClient } from '@/utils/supabase/server';

export async function checkProStatus() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { isPro: false, userId: null };
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', user.id)
        .single();

    return {
        isPro: profile?.is_pro || false,
        userId: user.id
    };
}
