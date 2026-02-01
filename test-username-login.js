const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const username = 'admin';
    const password = 'k5MfJG@qRaJ#Y3&XJBrGxf8k!kUFd3N^YW$7ws@WNS8Th1rT8geNYGEEt&R!St1E';

    console.log(`Attempting login for username: ${username}`);

    // 1. Lookup email using RPC
    const { data: email, error: rpcError } = await supabase
        .rpc('get_email_by_username', { username_input: username });

    if (rpcError || !email) {
        console.error('Email lookup failed:', rpcError);
        return;
    }

    console.log(`Found email: ${email}`);

    // 2. Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (authError) {
        console.error('Login failed:', authError.message);
    } else {
        console.log('Login successful!', authData.user.email);
    }
}

run();
