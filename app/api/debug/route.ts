'use server';

import { NextResponse } from 'next/server';

/**
 * Debug endpoint to test if environment variables and basic imports work
 * Access at: /api/debug
 */
export async function GET() {
    const diagnostics: Record<string, any> = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
    };

    // Check environment variables (don't expose full values)
    diagnostics.envVars = {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `Set (${process.env.GEMINI_API_KEY.substring(0, 10)}...)` : 'NOT SET',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'NOT SET',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'NOT SET',
    };

    // Test imports one by one
    const importTests: Record<string, string> = {};

    try {
        const { createClient } = await import('@/utils/supabase/server');
        importTests['supabase/server'] = 'OK';
    } catch (e: any) {
        importTests['supabase/server'] = `FAILED: ${e.message}`;
    }

    try {
        const { createStreamableValue } = await import('@ai-sdk/rsc');
        importTests['@ai-sdk/rsc'] = 'OK';
    } catch (e: any) {
        importTests['@ai-sdk/rsc'] = `FAILED: ${e.message}`;
    }

    try {
        const { getGeminiModel } = await import('@/app/lib/ai/gemini');
        importTests['lib/ai/gemini'] = 'OK';
    } catch (e: any) {
        importTests['lib/ai/gemini'] = `FAILED: ${e.message}`;
    }

    try {
        const { identifyTarget } = await import('@/app/lib/identifier');
        importTests['lib/identifier'] = 'OK';
    } catch (e: any) {
        importTests['lib/identifier'] = `FAILED: ${e.message}`;
    }

    try {
        const { logger } = await import('@/app/lib/logger');
        importTests['lib/logger'] = 'OK';
    } catch (e: any) {
        importTests['lib/logger'] = `FAILED: ${e.message}`;
    }

    try {
        const { deepLogger } = await import('@/app/lib/deepLogger');
        importTests['lib/deepLogger'] = 'OK';
    } catch (e: any) {
        importTests['lib/deepLogger'] = `FAILED: ${e.message}`;
    }

    try {
        const dns = await import('dns');
        importTests['dns (node)'] = 'OK';
    } catch (e: any) {
        importTests['dns (node)'] = `FAILED: ${e.message}`;
    }

    diagnostics.importTests = importTests;

    // Test Supabase connection
    try {
        const { createClient } = await import('@/utils/supabase/server');
        const supabase = await createClient();
        const { data, error } = await supabase.from('policy_versions').select('count').limit(1);
        diagnostics.supabaseConnection = error ? `Error: ${error.message}` : 'OK';
    } catch (e: any) {
        diagnostics.supabaseConnection = `Failed: ${e.message}`;
    }

    return NextResponse.json(diagnostics, { status: 200 });
}
