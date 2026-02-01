'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function signInWithUsername(formData: FormData) {
    const login = formData.get('login') as string
    const password = formData.get('password') as string
    const supabase = await createClient()

    let email = login

    // Check if input is NOT an email
    if (!login.includes('@')) {
        const { data: emailData, error } = await supabase
            .rpc('get_email_by_username', { username_input: login })

        if (error || !emailData) {
            return { error: 'Username not found' }
        }
        email = emailData
    }

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    redirect('/account')
}
