"use client"

import { useState, useEffect, useRef, useMemo, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp, Search, Globe, Link as LinkIcon, Lock, ShieldAlert, Eye, EyeOff, Zap, FileStack, ChevronRight, X, ScrollText, Shield, AlertOctagon, AlertCircle, CircleAlert, CircleCheck, Sparkles, Star, Users, Bell, List, Clock, Calendar } from "lucide-react"
import { clsx } from "clsx"
import { analyzeDomain, discoverAllPolicies, analyzeSpecificPolicy, analyzeText, submitPolicyFeedback } from "../actions"
import { readStreamableValue } from "@ai-sdk/rsc"
import { checkProStatus } from "../checkProStatus"
import { trackPolicy, untrackPolicy, getTrackedPolicies } from "../trackingActions"
import { submitCommunityScore, getCommunityScore, getUserVote } from "../communityActions"
import { useRouter, useSearchParams } from "next/navigation"
import PolicyVersions from "@/components/PolicyVersions"
import { EducationalDisclaimer } from "@/components/EducationalDisclaimer"

type AnalysisStep = "input" | "searching" | "processing" | "results"
type InputMethod = "file" | "url" | "paste"
type AnalysisMode = "single" | "comprehensive"
// Educational terminology + legacy support for backwards compatibility
type FindingCategory = "CONCERNING" | "NOTABLE" | "ATTENTION" | "STANDARD" | "POSITIVE" | "EXCELLENT" | "THREAT" | "WARNING" | "CAUTION" | "NORMAL" | "GOOD" | "BRILLIANT"

interface LabeledFinding {
  category: FindingCategory;
  text: string;
}

interface SecureUsageRecommendation {
  priority: "high" | "medium" | "low";
  recommendation: string;
}

interface DiscoveredPolicy {
  type: string;
  name: string;
  url: string;
}

interface PolicyAnalysisResult {
  type: string;
  name: string;
  url: string;
  analysis: any | null;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  error?: string;
}

/**
 * Category styling configuration
 * 
 * LEGAL NOTE: Categories have been renamed from legal-sounding terms to educational terms
 * to avoid unauthorized practice of law concerns. Legacy names are preserved for backwards compatibility.
 */
const FINDING_CATEGORY_CONFIG: Record<FindingCategory, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  // New educational terminology
  CONCERNING: {
    label: "CONCERNING",
    bgColor: "bg-red-500/10",
    textColor: "text-red-500",
    borderColor: "border-red-500/30",
    icon: AlertOctagon
  },
  NOTABLE: {
    label: "NOTABLE",
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/30",
    icon: AlertTriangle
  },
  ATTENTION: {
    label: "ATTENTION",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    icon: CircleAlert
  },
  STANDARD: {
    label: "STANDARD",
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/30",
    icon: Info
  },
  POSITIVE: {
    label: "POSITIVE",
    bgColor: "bg-green-500/10",
    textColor: "text-green-400",
    borderColor: "border-green-500/30",
    icon: CircleCheck
  },
  EXCELLENT: {
    label: "EXCELLENT",
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    icon: Sparkles
  },
  // Legacy categories (preserved for backwards compatibility with cached analyses)
  THREAT: {
    label: "CONCERNING",  // Display as new name
    bgColor: "bg-red-500/10",
    textColor: "text-red-500",
    borderColor: "border-red-500/30",
    icon: AlertOctagon
  },
  WARNING: {
    label: "NOTABLE",  // Display as new name
    bgColor: "bg-orange-500/10",
    textColor: "text-orange-400",
    borderColor: "border-orange-500/30",
    icon: AlertTriangle
  },
  CAUTION: {
    label: "ATTENTION",  // Display as new name
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    icon: CircleAlert
  },
  NORMAL: {
    label: "STANDARD",  // Display as new name
    bgColor: "bg-slate-500/10",
    textColor: "text-slate-400",
    borderColor: "border-slate-500/30",
    icon: Info
  },
  GOOD: {
    label: "POSITIVE",  // Display as new name
    bgColor: "bg-green-500/10",
    textColor: "text-green-400",
    borderColor: "border-green-500/30",
    icon: CircleCheck
  },
  BRILLIANT: {
    label: "EXCELLENT",  // Display as new name
    bgColor: "bg-cyan-500/10",
    textColor: "text-cyan-400",
    borderColor: "border-cyan-500/30",
    icon: Sparkles
  },
};

// Sort order for findings (most impactful first) - supports both new and legacy categories
const CATEGORY_SORT_ORDER: FindingCategory[] = [
  "CONCERNING", "THREAT",
  "NOTABLE", "WARNING",
  "ATTENTION", "CAUTION",
  "STANDARD", "NORMAL",
  "POSITIVE", "GOOD",
  "EXCELLENT", "BRILLIANT"
];

// Helper to extract sections from raw policy text for navigation
interface PolicySection {
  id: string;
  title: string;
  startIndex: number;
}

function AnalyzeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<AnalysisStep>("input")
  const [inputMethod, setInputMethod] = useState<InputMethod>("url")
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("single")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [progressSteps, setProgressSteps] = useState<string[]>([])
  const [analysisResults, setAnalysisResults] = useState<any | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)

  // Pro & Multi-policy State
  const [isPro, setIsPro] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [discoveredPolicies, setDiscoveredPolicies] = useState<DiscoveredPolicy[]>([])
  const [policyResults, setPolicyResults] = useState<PolicyAnalysisResult[]>([])
  const [selectedPolicyIndex, setSelectedPolicyIndex] = useState(0)
  const [analyzedDomain, setAnalyzedDomain] = useState<string | null>(null)

  // Community State
  const [communityScore, setCommunityScore] = useState<number | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const [userVote, setUserVote] = useState<number | null>(null)
  const [isTracked, setIsTracked] = useState(false)
  const [trackingLoading, setTrackingLoading] = useState(false)

  // Original Text Modal State - removed, now using dedicated page
  const [showOriginalText, setShowOriginalText] = useState(false)

  // Dropdown States
  const [dataCollectedOpen, setDataCollectedOpen] = useState(true)
  const [thirdPartyOpen, setThirdPartyOpen] = useState(true)

  // Expanded item states for long text
  const [expandedDataItems, setExpandedDataItems] = useState<Set<number>>(new Set())
  const [expandedThirdPartyItems, setExpandedThirdPartyItems] = useState<Set<number>>(new Set())

  // Community Score Voting UI
  const [showVoteSlider, setShowVoteSlider] = useState(false)
  const [voteValue, setVoteValue] = useState(50)

  // File Upload & Paste Text State
  const [pastedText, setPastedText] = useState("")
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)

  // Feedback State
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [correctUrlInput, setCorrectUrlInput] = useState("")
  const [showFeedbackInput, setShowFeedbackInput] = useState(false)

  useEffect(() => {
    checkProStatus().then(status => {
      setIsPro(status.isPro)
      setUserId(status.userId)
    })
  }, [])

  // Restore analysis state when returning from original-text page
  useEffect(() => {
    const returnToResults = searchParams.get('returnToResults')
    if (returnToResults === 'true') {
      const savedState = sessionStorage.getItem('analysisState')
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          setStep(state.step || 'result')
          setAnalysisMode(state.analysisMode || 'single')
          setPolicyResults(state.policyResults || [])
          setAnalysisResults(state.analysisResults || null)
          setSelectedPolicyIndex(state.selectedPolicyIndex || 0)
          setAnalyzedDomain(state.analyzedDomain || null)
          setSourceUrl(state.sourceUrl || null)
          // Restore feedback state to prevent multiple feedback submissions
          if (state.feedbackSent !== undefined) {
            setFeedbackSent(state.feedbackSent)
          }
          // Clear the sessionStorage after restoring
          sessionStorage.removeItem('analysisState')
          // Clear the URL param
          router.replace('/analyze', { scroll: false })
        } catch (e) {
          console.error('Failed to restore analysis state:', e)
        }
      }
    }
  }, [searchParams, router])

  const startAnalysis = async () => {
    // Reset feedback state for new analysis
    setFeedbackSent(false);
    setShowFeedbackInput(false);
    setCorrectUrlInput('');

    // Handle file/paste text analysis
    if (inputMethod === "file" || inputMethod === "paste") {
      await startTextAnalysis();
      return;
    }

    if (!searchQuery) return;

    // If Pro and comprehensive mode, do multi-policy analysis
    if (isPro && analysisMode === "comprehensive") {
      await startComprehensiveAnalysis();
      return;
    }

    // Standard single policy analysis
    setStep("searching")
    setProgressSteps([])
    setStatusMessage("Initializing...")
    setAnalysisResults(null)

    try {
      const { output } = await analyzeDomain(searchQuery);

      for await (const update of readStreamableValue(output)) {
        if (!update) continue;

        if (update.status === 'complete') {
          setAnalysisResults(update.data)
          setSourceUrl(update.data?.url || null)
          setAnalyzedDomain(update.data?.domain || null)
          setStep("results")

          if (update.data?.url) {
            fetchExtraData(update.data.url)
          }
        } else if (update.status === 'error') {
          setStep("input")
          alert("Analysis failed: " + update.message)
          break;
        } else {
          setStatusMessage(update.message)
          setProgressSteps(prev => {
            if (prev[prev.length - 1] !== update.message) {
              return [...prev, update.message]
            }
            return prev
          })
        }
      }
    } catch (error: any) {
      console.error("Analysis failed", error)
      setStep("input")
      alert("Analysis failed: " + (error?.message || "Unknown error"))
    }
  }

  const startTextAnalysis = async () => {
    if (!pastedText || pastedText.trim().length < 100) {
      alert("Please paste at least 100 characters of policy text.");
      return;
    }

    setStep("searching")
    setProgressSteps([])
    setStatusMessage("Analyzing your text...")
    setAnalysisResults(null)

    try {
      const sourceName = uploadedFileName || "Pasted Text";
      const { output } = await analyzeText(pastedText, sourceName);

      for await (const update of readStreamableValue(output)) {
        if (!update) continue;

        if (update.status === 'complete') {
          setAnalysisResults(update.data)
          setSourceUrl(null) // No URL for text analysis
          setAnalyzedDomain(update.data?.domain || sourceName)
          setStep("results")
        } else if (update.status === 'error') {
          setStep("input")
          alert("Analysis failed: " + update.message)
          break;
        } else {
          setStatusMessage(update.message)
          setProgressSteps(prev => {
            if (prev[prev.length - 1] !== update.message) {
              return [...prev, update.message]
            }
            return prev
          })
        }
      }
    } catch (error: any) {
      console.error("Text analysis failed", error)
      setStep("input")
      alert("Analysis failed: " + (error?.message || "Unknown error"))
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ['text/plain', 'text/html', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.html') && !file.name.endsWith('.pdf')) {
      alert("Please upload a .txt, .html, or .pdf file");
      return;
    }

    // For PDF files, we'd need a PDF parser - for now just support text files
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      alert("PDF support coming soon. Please copy the text and use 'Paste Text' instead.");
      return;
    }

    try {
      const text = await file.text();
      setPastedText(text);
      setUploadedFileName(file.name);
      setInputMethod("paste"); // Switch to paste view to show the text
    } catch (error) {
      alert("Failed to read file. Please try pasting the text instead.");
    }
  }

  const startComprehensiveAnalysis = async () => {
    setStep("searching")
    setProgressSteps([])
    setStatusMessage("Discovering all policies...")
    setDiscoveredPolicies([])
    setPolicyResults([])

    try {
      // Step 1: Discover all policies
      setProgressSteps(prev => [...prev, "Discovering available policies..."])
      const discovery = await discoverAllPolicies(searchQuery);

      if (!discovery.success || !discovery.policies || discovery.policies.length === 0) {
        throw new Error(discovery.error || "No policies found for this company");
      }

      setAnalyzedDomain(discovery.domain || null)
      setDiscoveredPolicies(discovery.policies)
      setProgressSteps(prev => [...prev, `Found ${discovery.policies!.length} policies: ${discovery.policies!.map(p => p.name).join(', ')}`])

      // Initialize results array
      const initialResults: PolicyAnalysisResult[] = discovery.policies.map(p => ({
        type: p.type,
        name: p.name,
        url: p.url,
        analysis: null,
        status: 'pending'
      }));
      setPolicyResults(initialResults);

      // Step 2: Analyze each policy
      setStatusMessage("Analyzing policies...")

      for (let i = 0; i < discovery.policies.length; i++) {
        const policy = discovery.policies[i];

        setPolicyResults(prev => prev.map((p, idx) =>
          idx === i ? { ...p, status: 'analyzing' } : p
        ));

        setProgressSteps(prev => [...prev, `Analyzing ${policy.name}...`])

        try {
          const { output } = await analyzeSpecificPolicy(policy.url, policy.name);

          for await (const update of readStreamableValue(output)) {
            if (!update) continue;

            if (update.status === 'complete') {
              setPolicyResults(prev => prev.map((p, idx) =>
                idx === i ? { ...p, status: 'complete', analysis: update.data } : p
              ));
              setProgressSteps(prev => [...prev, `✓ ${policy.name} analyzed (Score: ${update.data?.score || 'N/A'})`])
            } else if (update.status === 'error') {
              setPolicyResults(prev => prev.map((p, idx) =>
                idx === i ? { ...p, status: 'error', error: update.message } : p
              ));
              setProgressSteps(prev => [...prev, `✗ ${policy.name} failed: ${update.message}`])
            }
          }
        } catch (e: any) {
          setPolicyResults(prev => prev.map((p, idx) =>
            idx === i ? { ...p, status: 'error', error: e?.message || 'Unknown error' } : p
          ));
        }
      }

      // Get the updated policyResults to find first success
      // Note: We need to use a ref or callback to get the latest state
      // For now, we'll set these based on the first policy
      if (discovery.policies.length > 0) {
        setSourceUrl(discovery.policies[0].url);

        // Fetch extra data for the domain
        fetchExtraData(discovery.policies[0].url);
      }

      setStep("results")
      setStatusMessage("Analysis complete!")

    } catch (error: any) {
      console.error("Comprehensive analysis failed", error)
      setStep("input")
      alert("Analysis failed: " + (error?.message || "Unknown error"))
    }
  }

  const fetchExtraData = async (url: string) => {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, '');

      const scoreData = await getCommunityScore(domain);
      setCommunityScore(scoreData.averageScore);
      setVoteCount(scoreData.voteCount);

      const voteData = await getUserVote(domain);
      setUserVote(voteData.userScore);

      const trackedPolicies = await getTrackedPolicies();
      const isTracking = trackedPolicies.some((p: any) => p.domain === domain);
      setIsTracked(isTracking);
    } catch (e) {
      console.error("Failed to fetch extra data", e);
    }
  }

  // Get the current policy URL for tracking (works for both single and comprehensive modes)
  const getCurrentPolicyUrl = (): string | null => {
    if (analysisMode === "comprehensive" && currentPolicyResult?.url) {
      return currentPolicyResult.url;
    }
    return sourceUrl;
  }

  // Get the current domain for tracking
  const getCurrentDomain = (): string | null => {
    const url = getCurrentPolicyUrl();
    if (url) {
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return analyzedDomain;
      }
    }
    return analyzedDomain;
  }

  const handleTrackToggle = async () => {
    const policyUrl = getCurrentPolicyUrl();
    const domain = getCurrentDomain();

    if (!domain) {
      alert("Unable to determine domain for tracking");
      return;
    }

    setTrackingLoading(true);

    try {
      if (isTracked) {
        const result = await untrackPolicy(domain);
        if (result.success) {
          setIsTracked(false);
        } else {
          alert(result.error || "Failed to untrack policy");
        }
      } else {
        // Pass the policy URL and current analysis for change detection
        const result = await trackPolicy(domain, policyUrl || undefined, displayedAnalysis);
        if (result.success) {
          setIsTracked(true);
        } else {
          alert(result.error || "Failed to track policy");
        }
      }
    } catch (e: any) {
      console.error("Track toggle error:", e);
      alert("An error occurred while updating tracking");
    } finally {
      setTrackingLoading(false);
    }
  }

  const handleVote = async (score: number) => {
    const domain = getCurrentDomain();
    if (!domain) return;

    const result = await submitCommunityScore(domain, score);
    if (result.success && 'averageScore' in result) {
      setCommunityScore(result.averageScore);
      setVoteCount(result.voteCount!);
      setUserVote(score);
    }
  }

  // Toggle expanded state for data collected items
  const toggleDataItemExpanded = (index: number) => {
    setExpandedDataItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  // Toggle expanded state for third party items
  const toggleThirdPartyItemExpanded = (index: number) => {
    setExpandedThirdPartyItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }

  // Calculate aggregate score for comprehensive mode
  const aggregateScore = useMemo(() => {
    if (analysisMode !== "comprehensive" || policyResults.length === 0) return null;

    const completedResults = policyResults.filter(p => p.status === 'complete' && p.analysis?.score !== undefined);
    if (completedResults.length === 0) return null;

    // Weighted average: Privacy Policy and Terms of Service are more important
    let weightedSum = 0;
    let totalWeight = 0;

    completedResults.forEach(p => {
      let weight = 1;
      if (p.type === 'privacy') weight = 3; // Privacy policy most important
      else if (p.type === 'terms') weight = 2; // Terms second most important
      else weight = 1;

      weightedSum += (p.analysis?.score || 0) * weight;
      totalWeight += weight;
    });

    return Math.round(weightedSum / totalWeight);
  }, [analysisMode, policyResults]);

  // Navigate to original text page
  const openOriginalTextPage = () => {
    if (displayedAnalysis?.rawPolicyText) {
      // Store the analysis in sessionStorage for the original-text page
      sessionStorage.setItem('originalTextData', JSON.stringify({
        rawText: displayedAnalysis.rawPolicyText,
        domain: analyzedDomain,
        policyName: analysisMode === "comprehensive" && currentPolicyResult ? currentPolicyResult.name : "Privacy Policy",
        url: getCurrentPolicyUrl()
      }));
      // Store full analysis state for returning to results
      sessionStorage.setItem('analysisState', JSON.stringify({
        step,
        analysisMode,
        policyResults,
        analysisResults,
        selectedPolicyIndex,
        analyzedDomain,
        sourceUrl,
        feedbackSent  // Preserve feedback state
      }));
      router.push('/analyze/original-text');
    }
  }

  // Filter out failed policies - only show successfully analyzed ones
  const successfulPolicies = useMemo(() =>
    policyResults.filter(p => p.status === 'complete' && p.analysis),
    [policyResults]
  );

  // Map selectedPolicyIndex to the successful policies array
  const selectedSuccessfulIndex = useMemo(() => {
    if (successfulPolicies.length === 0) return 0;
    // Find the successful policy that matches the current selection
    const currentType = policyResults[selectedPolicyIndex]?.type;
    const idx = successfulPolicies.findIndex(p => p.type === currentType);
    return idx >= 0 ? idx : 0;
  }, [successfulPolicies, policyResults, selectedPolicyIndex]);

  const currentPolicyResult = successfulPolicies[selectedSuccessfulIndex] || policyResults[selectedPolicyIndex];
  const displayedAnalysis = analysisMode === "comprehensive" && currentPolicyResult?.analysis
    ? currentPolicyResult.analysis
    : analysisResults;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {step === "input" && (
        <div className="flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Analyze a Policy</h1>
            <p className="text-muted-foreground">Upload a document or search for a company's policy.</p>
          </div>

          {/* Mode Toggle for Pro Users */}
          {isPro && (
            <div className="flex items-center gap-2 p-1 bg-background/40 backdrop-blur-sm border border-white/10 rounded-lg">
              <Button
                variant={analysisMode === "single" ? "default" : "ghost"}
                size="sm"
                onClick={() => setAnalysisMode("single")}
                className={clsx(
                  "transition-all",
                  analysisMode === "single" && "shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                )}
              >
                <FileText className="h-4 w-4 mr-2" />
                Single Policy
              </Button>
              <Button
                variant={analysisMode === "comprehensive" ? "default" : "ghost"}
                size="sm"
                onClick={() => setAnalysisMode("comprehensive")}
                className={clsx(
                  "transition-all",
                  analysisMode === "comprehensive" && "shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                )}
              >
                <FileStack className="h-4 w-4 mr-2" />
                All Policies
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-black rounded">PRO</span>
              </Button>
            </div>
          )}

          {/* Input Method Toggle */}
          <div className="flex items-center gap-2 p-1 bg-background/40 backdrop-blur-sm border border-white/10 rounded-lg">
            <Button
              variant={inputMethod === "url" ? "default" : "ghost"}
              size="sm"
              onClick={() => setInputMethod("url")}
              className={clsx(
                "transition-all",
                inputMethod === "url" && "shadow-[0_0_10px_rgba(6,182,212,0.3)]"
              )}
            >
              <Search className="h-4 w-4 mr-2" />
              Search Company
            </Button>
            <Button
              variant={inputMethod === "paste" ? "default" : "ghost"}
              size="sm"
              onClick={() => setInputMethod("paste")}
              className={clsx(
                "transition-all",
                inputMethod === "paste" && "shadow-[0_0_10px_rgba(6,182,212,0.3)]"
              )}
            >
              <FileText className="h-4 w-4 mr-2" />
              Paste Text
            </Button>
            <label className="cursor-pointer">
              <input
                id="file-upload"
                type="file"
                accept=".txt,.html,.htm"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className={clsx(
                "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 rounded-md px-3 py-1",
                inputMethod === "file"
                  ? "bg-primary text-primary-foreground shadow hover:bg-primary/90 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}>
                <UploadCloud className="h-4 w-4" />
                Upload File
              </span>
            </label>
          </div>

          {/* Pro Mode Info */}
          {isPro && analysisMode === "comprehensive" && (
            <div className="w-full max-w-xl p-4 rounded-lg bg-gradient-to-r from-amber-400/10 to-orange-500/10 border border-amber-400/20">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-amber-400">Comprehensive Company Analysis</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll scan the entire company and analyze all available policies: Privacy Policy, Terms of Service, Cookie Policy, Security Policy, GDPR/CCPA notices, AI Terms, Data Processing Agreements, and more.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Non-Pro Upgrade Prompt for Comprehensive */}
          {!isPro && (
            <div className="w-full max-w-xl p-4 rounded-lg bg-gradient-to-r from-primary/5 to-cyan-500/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <FileStack className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Want to analyze all company policies?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upgrade to Pro to analyze Privacy Policy, Terms of Service, Cookie Policy, and all other legal documents in one click.
                  </p>
                  <a href="/plans" className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                    <Zap className="h-3 w-3" />
                    Upgrade to Pro
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-xl space-y-6">
            {/* URL Search Input */}
            {inputMethod === "url" && (
              <>
                <div className="relative">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 bg-background/40 border-white/10 backdrop-blur-sm transition-all"
                    placeholder="e.g. 'Google', 'Spotify', or 'https://example.com/privacy'"
                    onKeyDown={(e) => e.key === "Enter" && startAnalysis()}
                  />
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground pointer-events-none" />
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground text-left">
                      Enter a company name and our AI will automatically find and analyze their latest {analysisMode === "comprehensive" ? "Privacy Policy, Terms of Service, and all other legal documents" : "Privacy Policy"}.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Paste Text Input */}
            {inputMethod === "paste" && (
              <>
                <div className="space-y-2">
                  {uploadedFileName && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground p-2 bg-primary/5 rounded-lg">
                      <span className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {uploadedFileName}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadedFileName(null);
                          setPastedText("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <Textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    className="w-full min-h-[200px] bg-background/40 border-white/10 backdrop-blur-sm transition-all resize-y"
                    placeholder="Paste the privacy policy or terms of service text here..."
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {pastedText.length.toLocaleString()} characters
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground text-left">
                      Paste any policy document text and our AI will analyze it. Minimum 100 characters required.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Main Action Button */}
            <Button
              size="lg"
              className={clsx(
                "w-full max-w-xl text-lg h-14 rounded-lg transition-all",
                analysisMode === "comprehensive"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.7)]"
                  : "shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.7)]"
              )}
              onClick={startAnalysis}
              disabled={inputMethod === "url" ? !searchQuery : pastedText.length < 100}
            >
              {analysisMode === "comprehensive" ? (
                <>
                  <FileStack className="h-5 w-5 mr-2" />
                  Search Whole Company
                </>
              ) : (
                "Find & Analyze"
              )}
            </Button>
          </div>
        </div>
      )}

      {(step === "searching" || step === "processing") && (
        <div className="flex flex-col items-center justify-center py-20 space-y-8 animate-in fade-in duration-500">
          {/* Magnifying Glass Scanning Animation */}
          <div className="relative h-32 w-32 flex items-center justify-center">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />

            {/* Main magnifying glass container */}
            <div className="relative animate-[scan_2s_ease-in-out_infinite]">
              {/* Glass circle */}
              <div className="w-20 h-20 rounded-full border-4 border-primary bg-primary/10 backdrop-blur-sm flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                {/* Inner scanning line */}
                <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-[scanLine_1.5s_ease-in-out_infinite]" />
              </div>

              {/* Handle */}
              <div className="absolute -bottom-4 -right-4 w-4 h-12 bg-gradient-to-b from-primary to-cyan-600 rounded-full rotate-45 origin-top shadow-lg" />
            </div>

            {/* Orbiting dots */}
            <div className="absolute inset-0 animate-[spin_3s_linear_infinite]">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full" />
            </div>
            <div className="absolute inset-0 animate-[spin_4s_linear_infinite_reverse]">
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            </div>
          </div>

          <style jsx>{`
            @keyframes scan {
              0%, 100% { transform: translateX(-8px) rotate(-5deg); }
              50% { transform: translateX(8px) rotate(5deg); }
            }
            @keyframes scanLine {
              0%, 100% { opacity: 0.3; transform: scaleX(0.5); }
              50% { opacity: 1; transform: scaleX(1); }
            }
          `}</style>

          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-2xl font-bold text-foreground">{statusMessage}</h2>
            <div className="space-y-2 text-left bg-background/60 p-4 rounded-lg border border-white/10 backdrop-blur-md h-64 overflow-y-auto">
              {progressSteps.map((msg, i) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground animate-in fade-in slide-in-from-left-2">
                  <CheckCircle2 className={clsx(
                    "h-4 w-4 shrink-0",
                    msg.startsWith("✓") ? "text-green-500" : msg.startsWith("✗") ? "text-red-500" : "text-green-500"
                  )} />
                  <span className="text-sm">{msg.replace(/^[✓✗]\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === "results" && displayedAnalysis && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
          {/* Policy Tabs for Comprehensive Mode - Only show successfully analyzed policies */}
          {analysisMode === "comprehensive" && successfulPolicies.length > 1 && (
            <div className="flex flex-wrap gap-2 p-2 bg-background/40 backdrop-blur-sm border border-white/10 rounded-lg">
              {successfulPolicies.map((policy, index) => (
                <Button
                  key={policy.type}
                  variant={selectedSuccessfulIndex === index ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    // Find the original index in policyResults to maintain compatibility
                    const originalIndex = policyResults.findIndex(p => p.type === policy.type);
                    setSelectedPolicyIndex(originalIndex >= 0 ? originalIndex : index);
                  }}
                  className={clsx(
                    "transition-all",
                    selectedSuccessfulIndex === index && "shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  )}
                >
                  {policy.name}
                  {policy.analysis?.score && (
                    <span className={clsx(
                      "ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded",
                      policy.analysis.score >= 80 ? "bg-green-500/20 text-green-400" :
                        policy.analysis.score >= 60 ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-red-500/20 text-red-400"
                    )}>
                      {policy.analysis.score}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" className="pl-0 hover:bg-transparent hover:text-primary" onClick={() => setStep("input")}>
                  <ChevronDown className="h-4 w-4 rotate-90 mr-2" />
                  Back to Search
                </Button>
                {displayedAnalysis.rawPolicyText && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openOriginalTextPage}
                    className="border-white/10 hover:bg-white/5"
                  >
                    <ScrollText className="h-4 w-4 mr-2" />
                    Original Text
                  </Button>
                )}
              </div>
              <h1 className="text-4xl font-bold text-foreground">
                {analysisMode === "comprehensive" && currentPolicyResult ? currentPolicyResult.name : "Analysis Results"}
              </h1>

              {/* Educational Disclaimer - Critical for legal protection */}
              <EducationalDisclaimer />
              {/* Source URL Link - Always link to original policy, not just domain */}
              {(sourceUrl || (analysisMode === "comprehensive" && currentPolicyResult?.url)) && (
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={analysisMode === "comprehensive" && currentPolicyResult?.url ? currentPolicyResult.url : sourceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate max-w-md"
                  >
                    {analysisMode === "comprehensive" && currentPolicyResult?.url
                      ? currentPolicyResult.url
                      : sourceUrl}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    (Original Source)
                  </span>
                </div>
              )}
              {analyzedDomain && !sourceUrl && !currentPolicyResult?.url && (
                <p className="text-sm text-muted-foreground">
                  {analyzedDomain}
                </p>
              )}
              {/* Policy Last Updated Date */}
              {displayedAnalysis.last_updated && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Policy last updated: <span className="font-medium text-foreground">{displayedAnalysis.last_updated}</span>
                  </span>
                </div>
              )}
              <p className="text-muted-foreground text-lg">
                {displayedAnalysis.summary}
              </p>
              {/* Cache indicator - shows when results came from cache */}
              {displayedAnalysis.fromCache && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20 rounded-full flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Loaded from cache
                  </span>
                  {displayedAnalysis.cachedAt && (
                    <span className="text-xs text-muted-foreground">
                      Cached {new Date(displayedAnalysis.cachedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
              {/* Viewing historical version indicator */}
              {displayedAnalysis.viewingVersion && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Viewing historical version
                  </span>
                  <span className="text-xs text-muted-foreground">
                    from {new Date(displayedAnalysis.viewingVersion.date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Score Card - Shows aggregate score in comprehensive mode */}
            <Card className="w-full md:w-auto min-w-[300px] bg-background/60 backdrop-blur-xl border-primary/20 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <CardContent className="p-6">
                {analysisMode === "comprehensive" && aggregateScore !== null ? (
                  <div className="space-y-4">
                    {/* Aggregate Score */}
                    <div className="flex items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overall Score</p>
                        <div className="flex items-baseline gap-1">
                          <span className={clsx(
                            "text-5xl font-black tracking-tighter",
                            aggregateScore >= 80 ? "text-green-400" :
                              aggregateScore >= 60 ? "text-yellow-400" :
                                "text-red-500"
                          )}>
                            {aggregateScore}
                          </span>
                          <span className="text-muted-foreground font-medium">/100</span>
                        </div>
                      </div>
                      <div className={clsx(
                        "h-20 w-20 rounded-full flex items-center justify-center border-4 shadow-inner",
                        aggregateScore >= 80 ? "border-green-500/30 bg-green-500/10 text-green-400" :
                          aggregateScore >= 60 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                            "border-red-500/30 bg-red-500/10 text-red-500"
                      )}>
                        <Shield className="h-8 w-8" />
                      </div>
                    </div>
                    {/* Current Policy Score */}
                    {displayedAnalysis.score !== undefined && (
                      <div className="pt-3 border-t border-white/10">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                          {currentPolicyResult?.name || "Current"} Score
                        </p>
                        <span className={clsx(
                          "text-2xl font-bold",
                          displayedAnalysis.score >= 80 ? "text-green-400" :
                            displayedAnalysis.score >= 60 ? "text-yellow-400" :
                              "text-red-500"
                        )}>
                          {displayedAnalysis.score}
                        </span>
                        <span className="text-muted-foreground text-sm">/100</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Privacy Score</p>
                      <div className="flex items-baseline gap-1">
                        <span className={clsx(
                          "text-5xl font-black tracking-tighter",
                          displayedAnalysis.score >= 80 ? "text-green-400" :
                            displayedAnalysis.score >= 60 ? "text-yellow-400" :
                              "text-red-500"
                        )}>
                          {displayedAnalysis.score}
                        </span>
                        <span className="text-muted-foreground font-medium">/100</span>
                      </div>
                    </div>
                    <div className={clsx(
                      "h-20 w-20 rounded-full flex items-center justify-center border-4 shadow-inner",
                      displayedAnalysis.score >= 80 ? "border-green-500/30 bg-green-500/10 text-green-400" :
                        displayedAnalysis.score >= 60 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                          "border-red-500/30 bg-red-500/10 text-red-500"
                    )}>
                      <ShieldAlert className="h-8 w-8" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Track Policy Card - Pro Feature */}
          {userId && (
            <Card className={clsx(
              "border transition-all",
              !isPro
                ? "bg-white/5 border-white/10 opacity-75"
                : isTracked
                  ? "bg-primary/10 border-primary/30"
                  : "bg-white/5 border-white/10 hover:border-primary/30"
            )}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={clsx(
                    "h-10 w-10 rounded-lg flex items-center justify-center",
                    isTracked && isPro ? "bg-primary/20 text-primary" : "bg-white/10 text-muted-foreground"
                  )}>
                    <Bell className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground flex items-center gap-2">
                      {isTracked && isPro ? "Tracking this policy" : "Track this policy"}
                      {!isPro && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded">PRO</span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {!isPro
                        ? "Upgrade to Pro to get notified when policies change"
                        : isTracked
                          ? `You'll be notified when ${getCurrentDomain() || 'this policy'} changes`
                          : "Get notified when this privacy policy is updated"
                      }
                    </p>
                  </div>
                </div>
                {isPro ? (
                  <Button
                    variant={isTracked ? "outline" : "default"}
                    size="sm"
                    onClick={handleTrackToggle}
                    disabled={trackingLoading}
                    className={clsx(
                      isTracked && "border-primary/30 text-primary hover:bg-primary/10"
                    )}
                  >
                    {trackingLoading ? (
                      <span className="flex items-center">
                        <span className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {isTracked ? "Removing..." : "Adding..."}
                      </span>
                    ) : isTracked ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Tracking
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 mr-2" />
                        Track Policy
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => window.location.href = '/plans'}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Community Score Section */}
          <Card className="bg-background/40 border-white/10">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
                    <Users className="h-7 w-7 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Community Score</p>
                    <div className="flex items-baseline gap-2">
                      {communityScore !== null ? (
                        <>
                          <span className={clsx(
                            "text-3xl font-bold",
                            communityScore >= 80 ? "text-green-400" :
                              communityScore >= 60 ? "text-yellow-400" :
                                "text-red-500"
                          )}>
                            {communityScore}
                          </span>
                          <span className="text-muted-foreground text-sm">/100</span>
                          <span className="text-xs text-muted-foreground">({voteCount} {voteCount === 1 ? 'vote' : 'votes'})</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-sm">No votes yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {userVote !== null ? (
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm text-muted-foreground">Your rating: <span className="text-foreground font-medium">{userVote}/100</span></span>
                    </div>
                  ) : userId ? (
                    showVoteSlider ? (
                      <div className="flex flex-col gap-3 p-4 rounded-lg bg-white/5 border border-white/10 min-w-[250px]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Your rating:</span>
                          <span className={clsx(
                            "text-lg font-bold",
                            voteValue >= 80 ? "text-green-400" :
                              voteValue >= 60 ? "text-yellow-400" :
                                "text-red-500"
                          )}>{voteValue}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={voteValue}
                          onChange={(e) => setVoteValue(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowVoteSlider(false)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              handleVote(voteValue);
                              setShowVoteSlider(false);
                            }}
                            className="flex-1 bg-primary hover:bg-primary/90"
                          >
                            Submit
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowVoteSlider(true)}
                        className="border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                      >
                        <Star className="h-4 w-4 mr-2" />
                        Rate this policy
                      </Button>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground">Log in to rate this policy</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Policy Version History - PRO Feature */}
          {analyzedDomain && (
            <PolicyVersions
              domain={analyzedDomain}
              policyType={analysisMode === "comprehensive" && currentPolicyResult?.type
                ? currentPolicyResult.type
                : 'privacy'
              }
              isPro={isPro}
              onVersionSelect={(versionAnalysis) => {
                // Update displayed analysis with historical version
                if (analysisMode === "comprehensive" && currentPolicyResult) {
                  setPolicyResults(prev => prev.map((p, idx) =>
                    idx === selectedPolicyIndex
                      ? { ...p, analysis: versionAnalysis }
                      : p
                  ));
                } else {
                  setAnalysisResults(versionAnalysis);
                }
              }}
            />
          )}

          {/* Secure Usage Recommendations */}
          {displayedAnalysis.secure_usage_recommendations && displayedAnalysis.secure_usage_recommendations.length > 0 && (
            <Card className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Lock className="h-5 w-5" />
                  Secure Usage Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {displayedAnalysis.secure_usage_recommendations.map((rec: SecureUsageRecommendation, index: number) => (
                  <div
                    key={index}
                    className={clsx(
                      "flex items-start gap-3 p-3 rounded-lg border",
                      rec.priority === 'high' ? "bg-green-500/10 border-green-500/30" :
                        rec.priority === 'medium' ? "bg-emerald-500/10 border-emerald-500/20" :
                          "bg-teal-500/10 border-teal-500/20"
                    )}
                  >
                    <CircleCheck className={clsx(
                      "h-5 w-5 shrink-0 mt-0.5",
                      rec.priority === 'high' ? "text-green-400" :
                        rec.priority === 'medium' ? "text-emerald-400" :
                          "text-teal-400"
                    )} />
                    <p className="text-sm leading-relaxed">{rec.recommendation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Key Findings - Now with Labels */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Key Findings</h2>
            {displayedAnalysis.key_findings && (
              Array.isArray(displayedAnalysis.key_findings) && displayedAnalysis.key_findings.length > 0 ? (
                // Sort findings by severity
                [...displayedAnalysis.key_findings]
                  .sort((a: LabeledFinding | string, b: LabeledFinding | string) => {
                    // Handle both old string format and new object format
                    const catA = typeof a === 'object' && a.category ? a.category : 'NORMAL';
                    const catB = typeof b === 'object' && b.category ? b.category : 'NORMAL';
                    return CATEGORY_SORT_ORDER.indexOf(catA as FindingCategory) - CATEGORY_SORT_ORDER.indexOf(catB as FindingCategory);
                  })
                  .map((finding: LabeledFinding | string, index: number) => {
                    // Handle both old string format and new object format
                    const isLabeledFinding = typeof finding === 'object' && finding.category;
                    const category: FindingCategory = isLabeledFinding ? (finding as LabeledFinding).category : 'NORMAL';
                    const text = isLabeledFinding ? (finding as LabeledFinding).text : (finding as string);
                    const config = FINDING_CATEGORY_CONFIG[category];
                    const IconComponent = config.icon;

                    return (
                      <div
                        key={index}
                        className={clsx(
                          "p-4 rounded-lg border",
                          config.bgColor,
                          config.borderColor
                        )}
                      >
                        {/* Label row - icon and label at top */}
                        <div className="flex items-center gap-2 mb-1">
                          <IconComponent className={clsx("h-4 w-4 shrink-0", config.textColor)} />
                          <span className={clsx(
                            "text-[11px] font-bold uppercase tracking-wider",
                            config.textColor
                          )}>
                            {config.label}
                          </span>
                        </div>
                        {/* Description text below */}
                        <p className="text-sm leading-relaxed text-foreground/90 ml-6">{text}</p>
                      </div>
                    );
                  })
              ) : (
                <p className="text-muted-foreground text-sm">No key findings available.</p>
              )
            )}
          </div>

          {/* Data Collected & Third Party Sharing - Dropdowns with Expandable Items */}
          <div className="space-y-4">
            {/* Data Collected Dropdown */}
            <div className="border border-white/10 rounded-lg bg-background/40 overflow-hidden">
              <button
                onClick={() => setDataCollectedOpen(!dataCollectedOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <Eye className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground">Data Collected</h3>
                    <p className="text-xs text-muted-foreground">{displayedAnalysis.data_collected?.length || 0} data types identified</p>
                  </div>
                </div>
                {dataCollectedOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </button>
              {dataCollectedOpen && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-4">
                    {displayedAnalysis.data_collected?.map((item: string, i: number) => {
                      const isLong = item.length > 40;
                      const isExpanded = expandedDataItems.has(i);

                      return (
                        <button
                          key={i}
                          onClick={() => isLong && toggleDataItemExpanded(i)}
                          className={clsx(
                            "flex items-start gap-2 text-sm p-2 rounded-lg bg-white/5 border border-white/5 text-left transition-all",
                            isLong && "cursor-pointer hover:bg-white/10 hover:border-primary/20",
                            !isLong && "cursor-default"
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5"></div>
                          <span className={clsx(
                            "flex-1",
                            !isExpanded && isLong && "line-clamp-1"
                          )}>
                            {item}
                          </span>
                          {isLong && (
                            <ChevronDown className={clsx(
                              "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Third Party Sharing Dropdown */}
            <div className="border border-white/10 rounded-lg bg-background/40 overflow-hidden">
              <button
                onClick={() => setThirdPartyOpen(!thirdPartyOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-foreground">Third Party Sharing</h3>
                    <p className="text-xs text-muted-foreground">{displayedAnalysis.third_party_sharing?.length || 0} sharing partners identified</p>
                  </div>
                </div>
                {thirdPartyOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
              </button>
              {thirdPartyOpen && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-4">
                    {displayedAnalysis.third_party_sharing?.map((item: string, i: number) => {
                      const isLong = item.length > 40;
                      const isExpanded = expandedThirdPartyItems.has(i);

                      return (
                        <button
                          key={i}
                          onClick={() => isLong && toggleThirdPartyItemExpanded(i)}
                          className={clsx(
                            "flex items-start gap-2 text-sm p-2 rounded-lg bg-white/5 border border-white/5 text-left transition-all",
                            isLong && "cursor-pointer hover:bg-white/10 hover:border-orange-500/20",
                            !isLong && "cursor-default"
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5"></div>
                          <span className={clsx(
                            "flex-1",
                            !isExpanded && isLong && "line-clamp-1"
                          )}>
                            {item}
                          </span>
                          {isLong && (
                            <ChevronDown className={clsx(
                              "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                              isExpanded && "rotate-180"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Comprehensive Mode Summary - Only show successfully analyzed policies */}
          {analysisMode === "comprehensive" && successfulPolicies.length > 1 && (
            <Card className="bg-gradient-to-r from-primary/5 to-cyan-500/5 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileStack className="h-5 w-5" />
                  All Policies Overview ({successfulPolicies.length} analyzed)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {successfulPolicies.map((policy, index) => (
                    <button
                      key={policy.type}
                      onClick={() => {
                        const originalIndex = policyResults.findIndex(p => p.type === policy.type);
                        setSelectedPolicyIndex(originalIndex >= 0 ? originalIndex : index);
                      }}
                      className={clsx(
                        "p-4 rounded-lg border transition-all text-left",
                        selectedSuccessfulIndex === index
                          ? "bg-primary/10 border-primary/30"
                          : "bg-background/40 border-white/10 hover:bg-white/5"
                      )}
                    >
                      <p className="font-medium text-sm">{policy.name}</p>
                      {policy.analysis?.score !== undefined && (
                        <p className={clsx(
                          "text-2xl font-bold mt-1",
                          policy.analysis.score >= 80 ? "text-green-400" :
                            policy.analysis.score >= 60 ? "text-yellow-400" :
                              "text-red-500"
                        )}>
                          {policy.analysis.score}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin / Feedback Section */}
          <Card className="bg-background/40 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Help Improve Our AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!feedbackSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Did we find the correct policy? Your feedback trains our Neural Network.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500/30 hover:bg-green-500/10 hover:text-green-400"
                      onClick={() => {
                        // Immediately update UI
                        setFeedbackSent(true);

                        // Run training in background (don't await)
                        const domain = analyzedDomain || '';
                        const url = analysisMode === "comprehensive" && currentPolicyResult?.url ? currentPolicyResult.url : sourceUrl || '';
                        if (domain && url) {
                          submitPolicyFeedback(domain, url).catch(console.error);
                        }
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Yes, Correct
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                      onClick={() => setShowFeedbackInput(true)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      No, Incorrect
                    </Button>
                  </div>

                  {showFeedbackInput && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                      <Input
                        placeholder="Paste the correct policy URL here..."
                        value={correctUrlInput}
                        onChange={(e) => setCorrectUrlInput(e.target.value)}
                        className="bg-background/60"
                      />
                      <Button
                        size="sm"
                        disabled={!correctUrlInput}
                        onClick={() => {
                          // Immediately update UI
                          setFeedbackSent(true);
                          setShowFeedbackInput(false);

                          // Run training in background (don't await)
                          const domain = analyzedDomain || '';
                          const incorrectUrl = analysisMode === "comprehensive" && currentPolicyResult?.url ? currentPolicyResult.url : sourceUrl || '';
                          if (domain && correctUrlInput) {
                            submitPolicyFeedback(domain, correctUrlInput, incorrectUrl).catch(console.error);
                          }
                        }}
                      >
                        Submit Correction
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 animate-in fade-in">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="text-sm font-medium">Thank you! The Neural Network has been updated.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AnalyzeContent />
    </Suspense>
  )
}
