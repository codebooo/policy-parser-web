"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X, Loader2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { PaymentModal } from "@/components/PaymentModal"

export default function PlansPage() {
    const [loading, setLoading] = useState(false)
    const [isPaymentOpen, setIsPaymentOpen] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const router = useRouter()

    useEffect(() => {
        // Trigger fade-in animation on mount
        setIsVisible(true)
    }, [])

    const handleUpgradeClick = async () => {
        setLoading(true)
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            router.push('/login?redirect=/plans')
            return
        }

        setLoading(false)
        setIsPaymentOpen(true)
    }

    return (
        <div className="container mx-auto px-4 py-20">
            <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
                <p className="text-muted-foreground text-lg">Choose the plan that fits your needs.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {/* Free Plan */}
                <Card className={`bg-white/5 border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <CardHeader>
                        <CardTitle className="text-2xl">Free</CardTitle>
                        <CardDescription>Essential protection for everyone.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-4xl font-bold">€0</div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> Basic Policy Analysis</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> Privacy Score</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /> Risk Detection</li>
                            <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4" /> Expert Mode</li>
                            <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4" /> Mass Analysis</li>
                            <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4" /> Policy Tracking & Alerts</li>
                            <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4" /> Analysis History</li>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Link href="/analyze" className="w-full">
                            <Button className="w-full" variant="outline">Get Started</Button>
                        </Link>
                    </CardFooter>
                </Card>

                {/* Pro Plan */}
                <Card className={`bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/50 backdrop-blur-sm relative overflow-hidden transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">POPULAR</div>
                    <CardHeader>
                        <CardTitle className="text-2xl">Pro</CardTitle>
                        <CardDescription>Advanced tools for power users.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-4xl font-bold">€0.99<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Everything in Free</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Expert Mode (Full Site Scan)</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Mass Analysis (50+ sites)</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Policy Tracking & Alerts</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Unlimited History</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Priority Support</li>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button
                            className="w-full bg-primary hover:bg-primary/90"
                            onClick={handleUpgradeClick}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Upgrade Now"
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <PaymentModal
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
            />

            <div className={`mt-12 flex justify-center transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <form action={async () => {
                    const { toggleProStatus } = await import('./actions');
                    await toggleProStatus();
                }}>
                    <Button variant="ghost" className="text-muted-foreground hover:text-primary opacity-50 hover:opacity-100">
                        [Admin] Toggle Pro Status
                    </Button>
                </form>
            </div>
        </div>
    )
}

