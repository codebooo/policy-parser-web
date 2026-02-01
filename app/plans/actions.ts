'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleProStatus() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Not logged in' }

    // Check if admin
    if (user.email !== 'policyparser.admin@gmail.com') {
        return { error: 'Unauthorized' }
    }

    // Get current status
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_pro')
        .eq('id', user.id)
        .single()

    const newStatus = !profile?.is_pro

    // Update
    await supabase
        .from('profiles')
        .update({ is_pro: newStatus })
        .eq('id', user.id)

    revalidatePath('/plans')
    return { success: true, isPro: newStatus }
}
