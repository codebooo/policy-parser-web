import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { calculatePersonalRiskScore } from '@/app/lib/risk/calculator'

export async function GET() {
    try {
        const supabase = await createClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Calculate risk profile
        const result = await calculatePersonalRiskScore(user.id)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            profile: result.profile
        })

    } catch (error: any) {
        console.error('[API] Risk profile error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
