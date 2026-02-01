import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    const email = 'policyparser.admin@gmail.com'; // Trying a real-looking email
    const password = 'k5MfJG@qRaJ#Y3&XJBrGxf8k!kUFd3N^YW$7ws@WNS8Th1rT8geNYGEEt&R!St1E';

    // 1. Try to sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: 'Admin User',
                role: 'admin' // Custom claim
            }
        }
    });

    if (signUpError) {
        console.error("SignUp Error:", signUpError);
        return NextResponse.json({ error: signUpError.message, code: signUpError.status }, { status: 400 });
    }

    return NextResponse.json({ message: 'Admin account created successfully', user: signUpData.user });
}
