"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, ShieldAlert, Zap, UploadCloud, ArrowRight, Lock, Search, History } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [isHowItWorksVisible, setIsHowItWorksVisible] = useState(false);
  const [isProTeaserVisible, setIsProTeaserVisible] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const proTeaserRef = useRef<HTMLDivElement>(null);

  const features = [
    {
      title: "Instant Analysis",
      description: "Upload any PDF or paste text. Our AI processes 50+ pages in moments, not hours.",
      icon: Zap,
      gradient: "from-blue-500/20 to-cyan-500/20",
      textGradient: "from-blue-400 to-cyan-400",
      iconColor: "text-blue-400",
      hoverBg: "hover:bg-blue-500/25",
      shadow: "shadow-[0_0_30px_rgba(59,130,246,0.2)]"
    },
    {
      title: "Risk Detection",
      description: "We highlight potential \"gotchas\", exclusions, and red flags you need to know about.",
      icon: ShieldAlert,
      gradient: "from-violet-500/20 to-fuchsia-500/20",
      textGradient: "from-violet-400 to-fuchsia-400",
      iconColor: "text-violet-400",
      hoverBg: "hover:bg-violet-500/25",
      shadow: "shadow-[0_0_30px_rgba(139,92,246,0.2)]"
    },
    {
      title: "Plain English",
      description: "No more legalese. Get summaries and breakdowns in language anyone can understand.",
      icon: FileText,
      gradient: "from-cyan-500/20 to-emerald-500/20",
      textGradient: "from-cyan-400 to-emerald-400",
      iconColor: "text-cyan-400",
      hoverBg: "hover:bg-cyan-500/25",
      shadow: "shadow-[0_0_30px_rgba(6,182,212,0.2)]"
    },
    {
      title: "Secure & Private",
      description: "Your documents are encrypted and never shared. We prioritize your privacy above all.",
      icon: Lock,
      gradient: "from-emerald-500/20 to-teal-500/20",
      textGradient: "from-emerald-400 to-teal-400",
      iconColor: "text-emerald-400",
      hoverBg: "hover:bg-emerald-500/25",
      shadow: "shadow-[0_0_30px_rgba(16,185,129,0.2)]"
    },
    {
      title: "Smart Search",
      description: "Find specific clauses instantly. Don't waste time scrolling through endless pages.",
      icon: Search,
      gradient: "from-amber-500/20 to-orange-500/20",
      textGradient: "from-amber-400 to-orange-400",
      iconColor: "text-amber-400",
      hoverBg: "hover:bg-amber-500/25",
      shadow: "shadow-[0_0_30px_rgba(245,158,11,0.2)]"
    },
    {
      title: "History & Compare",
      description: "Track changes over time. See exactly what changed between versions.",
      icon: History,
      gradient: "from-rose-500/20 to-pink-500/20",
      textGradient: "from-rose-400 to-pink-400",
      iconColor: "text-rose-400",
      hoverBg: "hover:bg-rose-500/25",
      shadow: "shadow-[0_0_30px_rgba(244,63,94,0.2)]"
    }
  ];

  useEffect(() => {
    const observerOptions = {
      threshold: 0.2, // Trigger when 20% of the element is visible
      rootMargin: "0px 0px -100px 0px" // Trigger slightly before element fully enters viewport
    };

    const howItWorksObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        setIsHowItWorksVisible(entry.isIntersecting);
      });
    }, observerOptions);

    const proTeaserObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        setIsProTeaserVisible(entry.isIntersecting);
      });
    }, observerOptions);

    if (howItWorksRef.current) {
      howItWorksObserver.observe(howItWorksRef.current);
    }

    if (proTeaserRef.current) {
      proTeaserObserver.observe(proTeaserRef.current);
    }

    return () => {
      howItWorksObserver.disconnect();
      proTeaserObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full pt-24 md:pt-32 lg:pt-40 pb-32 relative overflow-hidden opacity-0 animate-[fadeIn_0.8s_ease-out_0.1s_forwards]">
        <div className="container px-4 md:px-6 mx-auto text-center relative z-10">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground max-w-4xl mx-auto drop-shadow-2xl">
            Demystify complex policy documents <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">in seconds.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Stop guessing what you're agreeing to. PolicyParser transforms dense legal text into clear, actionable insights so you can sign with confidence.
          </p>
          <div className="mt-5 flex justify-center gap-4">
            <Link href="/analyze">
              <Button size="lg" className="text-lg px-8 h-14 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.7)] transition-all hover:scale-105">
                Analyze Document Now
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button variant="outline" size="lg" className="text-lg px-8 h-14 rounded-xl border-primary/30 hover:bg-primary/10 hover:border-primary/60 transition-all">
                How it works
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full py-10 opacity-0 animate-[fadeIn_0.8s_ease-out_0.3s_forwards]">
        <div className="container px-4 md:px-6 mx-auto">
          {/* Features Carousel */}
          <div className="w-full inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)] py-10">
            <ul className="flex items-stretch justify-center md:justify-start [&_li]:mx-4 [&_img]:max-w-none animate-[scroll-reverse_60s_linear_infinite]">
              {[...features, ...features].map((feature, index) => (
                <li key={index} className="w-[350px] flex-shrink-0">
                  <Card className={`h-full bg-white/5 border-white/10 backdrop-blur-sm ${feature.hoverBg} transition-all duration-300 group overflow-hidden`}>
                    <CardContent className="p-8 flex flex-col items-center text-center gap-6 h-full">
                      <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-500 border border-white/5 ${feature.shadow}`}>
                        <feature.icon className={`h-8 w-8 ${feature.iconColor} group-hover:text-white transition-colors`} />
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r ${feature.textGradient}`}>{feature.title}</h3>
                        <p className="text-muted-foreground">{feature.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </div>

          {/* How It Works Section */}
          <div
            ref={howItWorksRef}
            className={`mt-32 mb-20 text-center space-y-16 transition-all duration-1000 ${isHowItWorksVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-20'
              }`}
          >
            <div className="space-y-4">
              <h2 className="text-4xl font-bold">How <span className="text-primary">PolicyParser</span> Works</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">We use advanced AI to read, understand, and summarize complex legal documents so you don't have to.</p>
            </div>

            <div className="relative max-w-4xl mx-auto">
              {/* Vertical Connecting Line */}
              <div className="absolute left-1/2 top-0 bottom-12 w-0.5 bg-gradient-to-b from-primary/20 via-primary/50 to-primary/20 -ml-0.5 hidden md:block"></div>
              {/* Mobile Line */}
              <div className="absolute left-8 top-0 bottom-12 w-0.5 bg-gradient-to-b from-primary/20 via-primary/50 to-primary/20 md:hidden"></div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col md:flex-row items-center md:justify-between gap-8 mb-16 group">
                <div className="md:w-[45%] md:text-right order-2 md:order-1 pl-20 md:pl-0 text-left md:text-right w-full">
                  <h3 className="text-2xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">1. Upload or Search</h3>
                  <p className="text-muted-foreground leading-relaxed">Simply upload a PDF/text file or search for a company's name. We automatically find their latest privacy policy or terms of service.</p>
                </div>
                <div className="order-1 md:order-2 flex-shrink-0 absolute left-0 md:relative md:left-auto">
                  <div className="h-16 w-16 bg-[#0f172a] border border-primary/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.15)] group-hover:scale-110 transition-transform duration-500 relative z-20">
                    <UploadCloud className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="md:w-[45%] order-3 md:order-3 hidden md:block"></div>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col md:flex-row items-center md:justify-between gap-8 mb-16 group">
                <div className="md:w-[45%] order-3 md:order-1 hidden md:block"></div>
                <div className="order-1 md:order-2 flex-shrink-0 absolute left-0 md:relative md:left-auto">
                  <div className="h-16 w-16 bg-[#0f172a] border border-violet-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.15)] group-hover:scale-110 transition-transform duration-500 relative z-20">
                    <Zap className="h-8 w-8 text-violet-400" />
                  </div>
                </div>
                <div className="md:w-[45%] md:text-left order-2 md:order-3 pl-20 md:pl-0 text-left w-full">
                  <h3 className="text-2xl font-bold mb-2 text-foreground group-hover:text-violet-400 transition-colors">2. AI Analysis</h3>
                  <p className="text-muted-foreground leading-relaxed">Our Gemini-powered AI scans the entire document in seconds, identifying risks, data collection practices, and "gotchas" hidden in the fine print.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col md:flex-row items-center md:justify-between gap-8 mb-8 group">
                <div className="md:w-[45%] md:text-right order-2 md:order-1 pl-20 md:pl-0 text-left md:text-right w-full">
                  <h3 className="text-2xl font-bold mb-2 text-foreground group-hover:text-emerald-400 transition-colors">3. Get Results</h3>
                  <p className="text-muted-foreground leading-relaxed">Receive a simple Privacy Score, a plain-English summary, and a detailed breakdown of threats and warnings.</p>
                </div>
                <div className="order-1 md:order-2 flex-shrink-0 absolute left-0 md:relative md:left-auto">
                  <div className="h-16 w-16 bg-[#0f172a] border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.15)] group-hover:scale-110 transition-transform duration-500 relative z-20">
                    <ShieldAlert className="h-8 w-8 text-emerald-400" />
                  </div>
                </div>
                <div className="md:w-[45%] order-3 md:order-3 hidden md:block"></div>
              </div>
            </div>

            <Link href="/analyze">
              <Button size="lg" className="mt-8 px-8 h-12 text-lg bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:scale-105">
                Try it yourself <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Pro Teaser */}
          <div
            ref={proTeaserRef}
            className={`mt-20 text-center space-y-6 max-w-2xl mx-auto transition-all duration-1000 ${isProTeaserVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-20'
              }`}
          >
            <h2 className="text-3xl font-bold">Go Pro</h2>
            <p className="text-muted-foreground">Unlock Expert Mode, Mass Analysis, and more for just 0.99€.</p>
            <Link href="/plans">
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
                View Plans
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
