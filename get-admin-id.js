const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'policyparser.admin@gmail.com',
        password: 'k5MfJG@qRaJ#Y3&XJBrGxf8k!kUFd3N^YW$7ws@WNS8Th1rT8geNYGEEt&R!St1E'
    });

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log('User ID:', data.user.id);
}

run();
