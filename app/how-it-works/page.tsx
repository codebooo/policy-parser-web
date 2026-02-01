"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, BrainCircuit, ShieldCheck, ArrowRight, AlertTriangle, Info, CheckCircle2, Search, Layers, Cpu, Code, Server, Globe, FileCode, GitBranch, Database, Lock, Shield, Eye, Network, Brain } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function HowItWorksPage() {
    const [isHeaderVisible, setIsHeaderVisible] = useState(false)
    const [isStepsVisible, setIsStepsVisible] = useState(false)
    const [isFindingsVisible, setIsFindingsVisible] = useState(false)
    const [isDeepDiveVisible, setIsDeepDiveVisible] = useState(false)
    const [isTechStackVisible, setIsTechStackVisible] = useState(false)

    const headerRef = useRef<HTMLDivElement>(null)
    const stepsRef = useRef<HTMLDivElement>(null)
    const findingsRef = useRef<HTMLDivElement>(null)
    const deepDiveRef = useRef<HTMLDivElement>(null)
    const techStackRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (entry.target === headerRef.current) setIsHeaderVisible(true)
                        if (entry.target === stepsRef.current) setIsStepsVisible(true)
                        if (entry.target === findingsRef.current) setIsFindingsVisible(true)
                        if (entry.target === deepDiveRef.current) setIsDeepDiveVisible(true)
                        if (entry.target === techStackRef.current) setIsTechStackVisible(true)
                    }
                })
            },
            { threshold: 0.1 }
        )

        if (headerRef.current) observer.observe(headerRef.current)
        if (stepsRef.current) observer.observe(stepsRef.current)
        if (findingsRef.current) observer.observe(findingsRef.current)
        if (deepDiveRef.current) observer.observe(deepDiveRef.current)
        if (techStackRef.current) observer.observe(techStackRef.current)

        return () => observer.disconnect()
    }, [])

    return (
        <div className="container mx-auto px-4 py-20 max-w-5xl">
            <div ref={headerRef} className={`text-center space-y-4 mb-16 transition-all duration-700 ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <h1 className={`text-4xl md:text-6xl font-bold text-foreground tracking-tight transition-all duration-700 delay-100 ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    How <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">PolicyParser</span> Works
                </h1>
                <p className={`text-xl text-muted-foreground max-w-2xl mx-auto transition-all duration-700 delay-200 ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    We use advanced AI to read, understand, and summarize complex legal documents so you don't have to.
                </p>
            </div>

            <div ref={stepsRef} className={`grid gap-12 relative transition-all duration-700 ${isStepsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                {/* Connecting Line (Desktop) */}
                <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-accent/50 to-transparent -translate-x-1/2 z-0"></div>

                {/* Step 1 */}
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-16">
                    <div className="w-full md:w-1/2 flex justify-center md:justify-end">
                        <div className="h-20 w-20 bg-primary/20 text-primary rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-md">
                            <UploadCloud className="h-10 w-10" />
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-foreground mb-2">1. Upload or Search</h2>
                        <p className="text-muted-foreground text-lg">
                            Simply upload a PDF/text file or search for a company's name. We automatically find their latest privacy policy or terms of service.
                        </p>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="relative z-10 flex flex-col md:flex-row-reverse items-center gap-8 md:gap-16">
                    <div className="w-full md:w-1/2 flex justify-center md:justify-start">
                        <div className="h-20 w-20 bg-secondary/20 text-secondary-foreground rounded-2xl flex items-center justify-center border border-secondary/30 shadow-[0_0_30px_rgba(124,58,237,0.3)] backdrop-blur-md">
                            <BrainCircuit className="h-10 w-10" />
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 text-center md:text-right">
                        <h2 className="text-2xl font-bold text-foreground mb-2">2. AI Analysis</h2>
                        <p className="text-muted-foreground text-lg">
                            Our Gemini-powered AI scans the entire document in seconds, identifying risks, data collection practices, and "gotchas" hidden in the fine print.
                        </p>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-16">
                    <div className="w-full md:w-1/2 flex justify-center md:justify-end">
                        <div className="h-20 w-20 bg-accent/20 text-accent rounded-2xl flex items-center justify-center border border-accent/30 shadow-[0_0_30px_rgba(34,211,238,0.3)] backdrop-blur-md">
                            <ShieldCheck className="h-10 w-10" />
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 text-center md:text-left">
                        <h2 className="text-2xl font-bold text-foreground mb-2">3. Get Results</h2>
                        <p className="text-muted-foreground text-lg">
                            Receive a simple Privacy Score, a plain-English summary, and a detailed breakdown of threats and warnings.
                        </p>
                    </div>
                </div>
            </div>

            <div ref={findingsRef} className={`mt-20 mb-20 transition-all duration-700 ${isFindingsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <h2 className={`text-3xl font-bold text-center text-foreground mb-10 transition-all duration-700 delay-100 ${isFindingsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>Understanding the Findings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border bg-red-950/40 border-red-900 text-red-200 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-1" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-red-500">Threat</span>
                            <p className="text-sm">Critical privacy violations, data sales, or severe security risks.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg border bg-orange-900/20 border-orange-800 text-orange-300 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-1" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-orange-400">Warning</span>
                            <p className="text-sm">Major concerns like broad data sharing or indefinite retention.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg border bg-yellow-900/20 border-yellow-800 text-yellow-300 flex items-start gap-3">
                        <Info className="h-5 w-5 text-yellow-400 shrink-0 mt-1" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-yellow-400">Caution</span>
                            <p className="text-sm">Minor issues or vague wording that requires attention.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg border bg-blue-900/20 border-blue-800 text-blue-300 flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-1" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-blue-400">Brilliant</span>
                            <p className="text-sm">Exceptional user protection that goes above and beyond.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg border bg-green-900/20 border-green-800 text-green-300 flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-1" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-green-400">Good</span>
                            <p className="text-sm">Positive features like clear opt-outs or data deletion rights.</p>
                        </div>
                    </div>
                    <div className="p-4 rounded-lg border bg-background/40 border-white/10 text-muted-foreground flex items-start gap-3">
                        <Info className="h-5 w-5 text-slate-400 shrink-0 mt-1" />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider block mb-1 text-slate-500">Normal</span>
                            <p className="text-sm">Standard industry practices that are neither good nor bad.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-20 text-center">
                <Link href="/analyze">
                    <Button size="lg" className="text-lg px-10 h-16 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)] transition-all hover:scale-105 group">
                        Try it yourself <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </Link>
            </div>
            <div ref={deepDiveRef} className={`mt-32 border-t border-white/10 pt-20 transition-all duration-700 ${isDeepDiveVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className={`text-center mb-16 transition-all duration-700 delay-100 ${isDeepDiveVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <h2 className="text-3xl font-bold text-foreground mb-4">Technical Deep Dive</h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        A comprehensive look at the architecture, algorithms, and engineering decisions that power PolicyParser's P.A.W.D. (Policy Analysis and Web Discovery) Engine.
                    </p>
                </div>

                {/* Architecture Overview */}
                <div className="mb-16 p-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                        <Network className="h-5 w-5 text-primary" />
                        System Architecture Overview
                    </h3>
                    <div className="bg-black/30 rounded-lg p-4 font-mono text-xs md:text-sm overflow-x-auto">
                        <pre className="text-muted-foreground">{`┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Input    │───▶│  Discovery Engine │───▶│   Extraction    │
│  (URL/Domain)   │    │    (PAWD)         │    │    Pipeline     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌────────▼────────┐
│   Results UI    │◀───│  Score Calculator │◀───│   AI Analysis   │
│  (React/Next)   │    │   (Deterministic) │    │ (Gemini 2.5 Pro)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL + RLS                     │
│  (analyses, profiles, tracked_policies, community_scores)       │
└─────────────────────────────────────────────────────────────────┘`}</pre>
                    </div>
                </div>

                <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                    
                    {/* Step 1: Discovery Engine */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Search className="w-5 h-5 text-primary" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground">1. Multi-Strategy Discovery Engine</h3>
                                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">PAWD Core</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                The P.A.W.D. engine employs a sophisticated cascading strategy system with intelligent fallbacks:
                            </p>
                            <div className="space-y-3">
                                <div className="flex items-start gap-2 text-xs">
                                    <Globe className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-blue-400 font-medium">DirectFetchStrategy</span>
                                        <span className="text-muted-foreground"> — Direct URL fetch with 500KB content scan, footer parsing for policy links, special handling for Meta/Twitter/TikTok</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 text-xs">
                                    <FileCode className="h-4 w-4 text-violet-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-violet-400 font-medium">StandardPathStrategy</span>
                                        <span className="text-muted-foreground"> — Probes 11+ common paths: /privacy, /privacy-policy, /legal/privacy, /policies/privacy, /about/privacy</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 text-xs">
                                    <Layers className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-emerald-400 font-medium">SitemapStrategy</span>
                                        <span className="text-muted-foreground"> — Parses robots.txt and XML sitemaps, supports gzip, regex matching for policy URLs</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 text-xs">
                                    <Search className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-amber-400 font-medium">SearchStrategy</span>
                                        <span className="text-muted-foreground"> — DuckDuckGo API fallback with site: operator, rate-limited</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-gradient-to-r from-primary/10 to-transparent rounded-lg border-l-2 border-primary text-xs">
                                <GitBranch className="h-3 w-3 text-primary inline mr-1" />
                                <span className="text-muted-foreground">Special Domain Handling: Facebook, Meta, Instagram, WhatsApp, Threads, Twitter, X, TikTok receive customized discovery with pre-mapped URLs</span>
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Extraction Pipeline */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Code className="w-5 h-5 text-violet-400" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground">2. Content Extraction Pipeline</h3>
                                <span className="text-xs font-mono text-violet-400 bg-violet-400/10 px-2 py-1 rounded">JSDOM + Readability</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                A robust multi-stage extraction process handles any web page architecture:
                            </p>
                            <div className="bg-black/30 rounded-lg p-3 font-mono text-xs mb-4">
                                <div className="text-blue-400">1. HTTP GET with custom headers (mimics browser)</div>
                                <div className="text-gray-500 pl-4">↓</div>
                                <div className="text-violet-400">2. Parse HTML with JSDOM (full DOM tree)</div>
                                <div className="text-gray-500 pl-4">↓</div>
                                <div className="text-emerald-400">3. Mozilla Readability extraction attempt</div>
                                <div className="text-gray-500 pl-4">↓ (if fails)</div>
                                <div className="text-amber-400">4. Direct DOM text extraction fallback</div>
                                <div className="text-gray-500 pl-4">↓</div>
                                <div className="text-cyan-400">5. Clean & normalize extracted text</div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="p-2 rounded bg-violet-500/10 text-center">
                                    <div className="text-violet-400 font-medium">Primary</div>
                                    <div className="text-muted-foreground">Readability</div>
                                </div>
                                <div className="p-2 rounded bg-blue-500/10 text-center">
                                    <div className="text-blue-400 font-medium">Fallback</div>
                                    <div className="text-muted-foreground">DOM Walker</div>
                                </div>
                                <div className="p-2 rounded bg-emerald-500/10 text-center">
                                    <div className="text-emerald-400 font-medium">Binary</div>
                                    <div className="text-muted-foreground">PDF Parser</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 3: AI Analysis */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Brain className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground">3. AI Analysis Engine</h3>
                                <span className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Gemini 2.5 Pro</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                Powered by Google's Gemini 2.5 Pro with 2M token context window — entire policies processed in a single pass:
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-black/30 rounded-lg p-3 font-mono text-xs">
                                    <div className="text-emerald-400 mb-2">// Model Config</div>
                                    <div><span className="text-gray-500">model:</span> <span className="text-emerald-400">"gemini-2.5-pro"</span></div>
                                    <div><span className="text-gray-500">temp:</span> <span className="text-cyan-400">0.7</span></div>
                                    <div><span className="text-gray-500">context:</span> <span className="text-cyan-400">2,000,000</span></div>
                                </div>
                                <div className="bg-black/30 rounded-lg p-3 font-mono text-xs">
                                    <div className="text-blue-400 mb-2">// Output Schema</div>
                                    <div><span className="text-gray-500">summary:</span> <span className="text-blue-400">string</span></div>
                                    <div><span className="text-gray-500">findings:</span> <span className="text-violet-400">Finding[]</span></div>
                                    <div><span className="text-gray-500">data:</span> <span className="text-amber-400">string[]</span></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-6 gap-1 text-xs text-center">
                                <div className="p-1 rounded bg-red-500/20 text-red-400">THREAT</div>
                                <div className="p-1 rounded bg-orange-500/20 text-orange-400">WARNING</div>
                                <div className="p-1 rounded bg-yellow-500/20 text-yellow-400">CAUTION</div>
                                <div className="p-1 rounded bg-gray-500/20 text-gray-400">NORMAL</div>
                                <div className="p-1 rounded bg-green-500/20 text-green-400">GOOD</div>
                                <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">BRILLIANT</div>
                            </div>
                        </div>
                    </div>

                    {/* Step 4: Scoring Algorithm */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Cpu className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground">4. Privacy Scoring Algorithm</h3>
                                <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-1 rounded">Deterministic</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                The Privacy Score (0-100) is computed using a weighted penalty/bonus system:
                            </p>
                            <div className="bg-black/30 rounded-lg p-3 font-mono text-xs mb-4">
                                <div className="text-amber-400 mb-2">// Scoring Algorithm</div>
                                <div><span className="text-violet-400">let</span> score = <span className="text-cyan-400">100</span>;</div>
                                <div className="mt-1">score -= <span className="text-red-400">THREAT</span> * <span className="text-cyan-400">20</span>;</div>
                                <div>score -= <span className="text-orange-400">WARNING</span> * <span className="text-cyan-400">10</span>;</div>
                                <div>score -= <span className="text-yellow-400">CAUTION</span> * <span className="text-cyan-400">4</span>;</div>
                                <div>score += <span className="text-green-400">GOOD</span> * <span className="text-cyan-400">5</span>;</div>
                                <div>score += <span className="text-emerald-400">BRILLIANT</span> * <span className="text-cyan-400">8</span>;</div>
                                <div className="mt-1"><span className="text-violet-400">return</span> clamp(score, 0, 100);</div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs text-center">
                                <div className="p-2 rounded bg-gradient-to-b from-red-500/20 to-red-500/5 border border-red-500/30">
                                    <div className="font-bold text-red-400">0-25</div>
                                    <div className="text-muted-foreground">Critical</div>
                                </div>
                                <div className="p-2 rounded bg-gradient-to-b from-orange-500/20 to-orange-500/5 border border-orange-500/30">
                                    <div className="font-bold text-orange-400">26-50</div>
                                    <div className="text-muted-foreground">High Risk</div>
                                </div>
                                <div className="p-2 rounded bg-gradient-to-b from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30">
                                    <div className="font-bold text-yellow-400">51-75</div>
                                    <div className="text-muted-foreground">Moderate</div>
                                </div>
                                <div className="p-2 rounded bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30">
                                    <div className="font-bold text-emerald-400">76-100</div>
                                    <div className="text-muted-foreground">Safe</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 5: Database & Storage */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Database className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground">5. Database Architecture</h3>
                                <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded">Supabase PostgreSQL</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                All data stored with Row Level Security (RLS) for complete data isolation:
                            </p>
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-black/30 rounded-lg p-3 font-mono text-xs">
                                    <div className="text-cyan-400 mb-1">-- analyses</div>
                                    <div className="text-gray-500">user_id, domain, policy_url</div>
                                    <div className="text-gray-500">result (jsonb), score</div>
                                </div>
                                <div className="bg-black/30 rounded-lg p-3 font-mono text-xs">
                                    <div className="text-cyan-400 mb-1">-- tracked_policies</div>
                                    <div className="text-gray-500">user_id, domain</div>
                                    <div className="text-gray-500">policy_hash, last_checked</div>
                                </div>
                            </div>
                            <div className="flex gap-2 text-xs">
                                <div className="flex-1 p-2 rounded bg-cyan-500/10 text-center">
                                    <Shield className="h-3 w-3 text-cyan-400 inline mr-1" />
                                    <span className="text-cyan-400">RLS Enforced</span>
                                </div>
                                <div className="flex-1 p-2 rounded bg-blue-500/10 text-center">
                                    <Eye className="h-3 w-3 text-blue-400 inline mr-1" />
                                    <span className="text-blue-400">Community Scores</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 6: Security */}
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                            <Lock className="w-5 h-5 text-rose-400" />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-foreground">6. Security & Privacy</h3>
                                <span className="text-xs font-mono text-rose-400 bg-rose-400/10 px-2 py-1 rounded">Privacy-First</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">
                                We practice what we preach — your data is protected:
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="flex items-start gap-2 p-2 rounded bg-rose-500/10">
                                    <Lock className="h-3 w-3 text-rose-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-rose-400 font-medium">Zero Retention</span>
                                        <div className="text-muted-foreground">Policy content processed in-memory only</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 p-2 rounded bg-blue-500/10">
                                    <Shield className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-blue-400 font-medium">TLS Everywhere</span>
                                        <div className="text-muted-foreground">All connections encrypted</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 p-2 rounded bg-violet-500/10">
                                    <Server className="h-3 w-3 text-violet-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-violet-400 font-medium">Server-Side Only</span>
                                        <div className="text-muted-foreground">No direct third-party access</div>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 p-2 rounded bg-emerald-500/10">
                                    <Eye className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-emerald-400 font-medium">No Tracking</span>
                                        <div className="text-muted-foreground">No analytics or data sales</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Tech Stack Summary */}
                <div ref={techStackRef} className={`mt-16 p-6 rounded-2xl border border-white/10 bg-white/5 transition-all duration-700 ${isTechStackVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <h3 className={`text-lg font-bold text-center text-foreground mb-6 transition-all duration-700 delay-100 ${isTechStackVisible ? 'opacity-100' : 'opacity-0'}`}>Technology Stack</h3>
                    <div className={`flex flex-wrap justify-center gap-3 text-xs transition-all duration-700 delay-200 ${isTechStackVisible ? 'opacity-100' : 'opacity-0'}`}>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">Next.js 16</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">React 19</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">TypeScript</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">Tailwind CSS</span>
                        <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">Gemini 2.5 Pro</span>
                        <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">Supabase</span>
                        <span className="px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-400">Stripe</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">JSDOM</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">Mozilla Readability</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">Zod</span>
                        <span className="px-3 py-1.5 rounded-full bg-black/30 border border-white/10 text-muted-foreground">got HTTP</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
