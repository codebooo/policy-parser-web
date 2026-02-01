import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getDataExposureMap } from '@/app/lib/risk/calculator'

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

        // Get exposure map
        const result = await getDataExposureMap(user.id)

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            exposureMap: result.exposureMap
        })

    } catch (error: any) {
        console.error('[API] Exposure map error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
