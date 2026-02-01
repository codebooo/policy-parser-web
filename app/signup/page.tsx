'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import GoalsSelector from '@/components/GoalsSelector'
import RegionSelector from '@/components/RegionSelector'
import { cn } from '@/lib/utils'

type SignupStep = 'account' | 'goals' | 'region'

export default function SignupPage() {
    const [step, setStep] = useState<SignupStep>('account')
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [selectedGoals, setSelectedGoals] = useState<string[]>([])
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const steps: SignupStep[] = ['account', 'goals', 'region']
    const currentStepIndex = steps.indexOf(step)

    const handleAccountSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        // Check if username is taken
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('username')
            .eq('username', username)
            .single()

        if (existingUser) {
            setError("Username already taken")
            setLoading(false)
            return
        }

        setLoading(false)
        setStep('goals')
    }

    const handleGoalsSubmit = () => {
        if (selectedGoals.length === 0) {
            setError('Please select at least one goal')
            return
        }
        setError(null)
        setStep('region')
    }

    const handleFinalSubmit = async () => {
        setLoading(true)
        setError(null)

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
                data: {
                    username: username
                }
            },
        })

        if (signUpError) {
            setError(signUpError.message)
            setLoading(false)
            return
        }

        // Create profile and user_profile
        if (data.user) {
            // Create basic profile
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{ id: data.user.id, email: data.user.email, username: username }])

            if (profileError) {
                console.error('Error creating profile:', profileError)
            }

            // Create user_profile with goals and region
            const { error: userProfileError } = await supabase
                .from('user_profiles')
                .insert([{ 
                    user_id: data.user.id, 
                    goals: selectedGoals,
                    region: selectedRegion,
                    email_on_policy_change: true,
                    email_on_score_drop: true
                }])

            if (userProfileError) {
                console.error('Error creating user profile:', userProfileError)
            }
        }

        router.push('/account')
        router.refresh()
    }

    const goBack = () => {
        setError(null)
        if (step === 'goals') setStep('account')
        if (step === 'region') setStep('goals')
    }

    return (
        <div className="container mx-auto flex items-center justify-center min-h-[80vh] px-4 py-8">
            <Card className={cn(
                "w-full bg-background/40 backdrop-blur-md border-white/10 transition-all duration-300",
                step === 'account' ? "max-w-md" : "max-w-3xl"
            )}>
                <CardHeader className="space-y-1">
                    {/* Progress indicator */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                        {steps.map((s, i) => (
                            <div key={s} className="flex items-center">
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                                    i < currentStepIndex 
                                        ? "bg-green-500 text-white" 
                                        : i === currentStepIndex 
                                            ? "bg-primary text-primary-foreground" 
                                            : "bg-white/10 text-muted-foreground"
                                )}>
                                    {i < currentStepIndex ? (
                                        <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={cn(
                                        "w-12 h-0.5 mx-1 transition-colors",
                                        i < currentStepIndex ? "bg-green-500" : "bg-white/10"
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>

                    <CardTitle className="text-2xl font-bold text-center">
                        {step === 'account' && 'Create an account'}
                        {step === 'goals' && 'Personalize your experience'}
                        {step === 'region' && 'Your location'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {step === 'account' && 'Enter your details below to get started'}
                        {step === 'goals' && 'Tell us what you want to achieve with PolicyParser'}
                        {step === 'region' && 'Help us show relevant privacy laws and rights'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Step 1: Account Details */}
                    {step === 'account' && (
                        <form onSubmit={handleAccountSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="username" className="text-sm font-medium leading-none">Username</label>
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="johndoe"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="text-sm font-medium leading-none">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="password" className="text-sm font-medium leading-none">Password</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    required
                                    minLength={6}
                                />
                            </div>
                            {error && (
                                <div className="text-sm text-red-500 text-center p-2 bg-red-500/10 rounded-lg">
                                    {error}
                                </div>
                            )}
                            <Button className="w-full" type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </form>
                    )}

                    {/* Step 2: Goals Selection */}
                    {step === 'goals' && (
                        <div className="space-y-6">
                            <GoalsSelector
                                selectedGoals={selectedGoals}
                                onGoalsChange={setSelectedGoals}
                                minRequired={1}
                                maxAllowed={5}
                                loading={loading}
                                error={error}
                            />
                            <div className="flex gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={goBack}
                                    className="flex-1"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button 
                                    className="flex-1" 
                                    onClick={handleGoalsSubmit}
                                    disabled={selectedGoals.length === 0}
                                >
                                    Continue
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Region Selection */}
                    {step === 'region' && (
                        <div className="space-y-6">
                            <RegionSelector
                                selectedRegion={selectedRegion}
                                onRegionChange={setSelectedRegion}
                                loading={loading}
                                error={error}
                            />
                            <div className="flex gap-3">
                                <Button 
                                    variant="outline" 
                                    onClick={goBack}
                                    className="flex-1"
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back
                                </Button>
                                <Button 
                                    className="flex-1" 
                                    onClick={handleFinalSubmit}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {selectedRegion ? 'Complete Setup' : 'Skip & Finish'}
                                </Button>
                            </div>
                            {!selectedRegion && (
                                <p className="text-xs text-center text-muted-foreground">
                                    You can update your region later in settings
                                </p>
                            )}
                        </div>
                    )}

                    {step === 'account' && (
                        <div className="mt-4 text-center text-sm">
                            Already have an account?{" "}
                            <Link href="/login" className="underline hover:text-primary">
                                Sign in
                            </Link>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
