"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ScrollText, List, Search, ChevronUp, ExternalLink, Copy, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { clsx } from "clsx"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface PolicySection {
  id: string;
  title: string;
  level: number; // 1 = main heading, 2 = subheading
  element?: HTMLElement;
}

interface OriginalTextData {
  rawText: string;
  domain: string | null;
  policyName: string;
  url: string | null;
}

export default function OriginalTextPage() {
  const router = useRouter()
  const [data, setData] = useState<OriginalTextData | null>(null)
  const [sections, setSections] = useState<PolicySection[]>([])
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<number[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [copied, setCopied] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(false)

  const contentRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    // Load data from sessionStorage
    const storedData = sessionStorage.getItem('originalTextData')
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData) as OriginalTextData
        setData(parsed)

        // Extract sections from the text
        const extractedSections = extractSections(parsed.rawText)
        setSections(extractedSections)
      } catch (e) {
        console.error("Failed to parse stored data:", e)
        router.push('/analyze')
      }
    } else {
      router.push('/analyze')
    }
  }, [router])

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500)

      // Update active section based on scroll position
      if (sectionRefs.current.size > 0) {
        let currentActive: string | null = null

        sectionRefs.current.forEach((element, id) => {
          const rect = element.getBoundingClientRect()
          if (rect.top <= 150) {
            currentActive = id
          }
        })

        if (currentActive) {
          setActiveSection(currentActive)
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Extract sections from policy text
  const extractSections = (text: string): PolicySection[] => {
    const sections: PolicySection[] = []
    const lines = text.split('\n')

    // Common section patterns in privacy policies
    const headingPatterns = [
      /^#+\s+(.+)$/,                           // Markdown headings
      /^([A-Z][A-Z\s]{3,}[A-Z])$/,             // ALL CAPS headings
      /^(\d+\.?\s+[A-Z][^.]+)$/,               // Numbered headings (1. Introduction)
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*):?$/,  // Title Case headings
      /^(What|How|Why|When|Who|Your|Our|The|Data|Information|Privacy|Cookie|Security|Contact|Changes|Rights|Third|Collection|Use|Sharing|Retention|Children|International|Updates?|Notice|Policy).+$/i,
    ]

    let sectionCounter = 0

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.length < 3 || trimmedLine.length > 100) return

      let isHeading = false
      let level = 2
      let title = trimmedLine

      // Check each pattern
      for (const pattern of headingPatterns) {
        const match = trimmedLine.match(pattern)
        if (match) {
          isHeading = true
          title = match[1] || trimmedLine
          // Determine level based on pattern type
          if (pattern.source.includes('#+')) {
            const hashMatch = trimmedLine.match(/^(#+)/)
            level = hashMatch ? Math.min(hashMatch[1].length, 2) : 1
          } else if (pattern.source.includes('[A-Z][A-Z')) {
            level = 1 // ALL CAPS = main heading
          } else if (pattern.source.includes('\\d+')) {
            level = 1 // Numbered = main heading
          }
          break
        }
      }

      // Additional heuristic: short lines followed by longer content
      if (!isHeading && trimmedLine.length < 60) {
        const nextLine = lines[index + 1]?.trim()
        if (nextLine && nextLine.length > trimmedLine.length * 2) {
          // Could be a heading
          if (/^[A-Z]/.test(trimmedLine) && !/[.!?]$/.test(trimmedLine)) {
            isHeading = true
            level = 2
            title = trimmedLine
          }
        }
      }

      if (isHeading) {
        sectionCounter++
        sections.push({
          id: `section-${sectionCounter}`,
          title: title.replace(/^#+\s*/, '').replace(/:$/, '').trim(),
          level
        })
      }
    })

    // If we didn't find many sections, create some based on paragraphs
    if (sections.length < 3) {
      const paragraphs = text.split(/\n\n+/)
      paragraphs.forEach((para, index) => {
        if (index % 5 === 0 && para.trim()) {
          const firstLine = para.trim().split('\n')[0]
          if (firstLine.length < 80) {
            sections.push({
              id: `para-${index}`,
              title: firstLine.substring(0, 50) + (firstLine.length > 50 ? '...' : ''),
              level: 2
            })
          }
        }
      })
    }

    return sections.slice(0, 20) // Limit to 20 sections for usability
  }

  // Format text with section markers
  const formattedText = useMemo(() => {
    if (!data?.rawText) return ''

    let text = data.rawText
    let sectionIndex = 0

    // Add IDs to sections in the text
    sections.forEach(section => {
      const escapedTitle = section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`(^|\\n)(${escapedTitle})`, 'i')
      text = text.replace(pattern, `$1<span id="${section.id}" class="section-marker"></span>$2`)
      sectionIndex++
    })

    return text
  }, [data?.rawText, sections])

  // Search functionality
  useEffect(() => {
    if (!searchQuery || !data?.rawText) {
      setSearchResults([])
      return
    }

    const indices: number[] = []
    const lowerText = data.rawText.toLowerCase()
    const lowerQuery = searchQuery.toLowerCase()
    let index = lowerText.indexOf(lowerQuery)

    while (index !== -1 && indices.length < 100) {
      indices.push(index)
      index = lowerText.indexOf(lowerQuery, index + 1)
    }

    setSearchResults(indices)
    setCurrentSearchIndex(0)
  }, [searchQuery, data?.rawText])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copyToClipboard = async () => {
    if (data?.rawText) {
      await navigator.clipboard.writeText(data.rawText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/analyze?returnToResults=true')}
                className="hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="hidden sm:block h-6 w-px bg-white/10" />
              <div className="hidden sm:flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">{data.policyName}</h1>
                {data.domain && (
                  <span className="text-sm text-muted-foreground">— {data.domain}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-40 sm:w-56 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-primary/50"
                />
                {searchResults.length > 0 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currentSearchIndex + 1}/{searchResults.length}
                  </span>
                )}
              </div>

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="hidden sm:flex border-white/10"
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copied!" : "Copy"}
              </Button>

              {data.url && (
                <a href={data.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="border-white/10">
                    <ExternalLink className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">View Original</span>
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div
              ref={contentRef}
              className="prose prose-invert prose-sm max-w-none bg-background/40 border border-white/10 rounded-xl p-6 sm:p-8"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-foreground mt-6 mb-3 scroll-mt-24">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-semibold text-foreground/90 mt-4 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-muted-foreground leading-relaxed mb-4">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-bold text-foreground">{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-foreground/90">{children}</em>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-4 text-muted-foreground">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-muted-foreground">{children}</li>
                  ),
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{children}</a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-primary/30 pl-4 my-4 italic text-muted-foreground">{children}</blockquote>
                  ),
                }}
              >
                {data.rawText}
              </ReactMarkdown>
            </div>
          </div>

          {/* Navigation Sidebar */}
          <div className={clsx(
            "hidden lg:block sticky top-24 h-fit transition-all",
            navCollapsed ? "w-12" : "w-64"
          )}>
            <div className="bg-background/60 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setNavCollapsed(!navCollapsed)}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors border-b border-white/10"
              >
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  {!navCollapsed && <span className="text-sm font-medium">Navigation</span>}
                </div>
                <ChevronLeft className={clsx(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  navCollapsed && "rotate-180"
                )} />
              </button>

              {!navCollapsed && (
                <nav className="max-h-[calc(100vh-200px)] overflow-y-auto p-2">
                  <ul className="space-y-1">
                    {sections.map((section) => (
                      <li key={section.id}>
                        <button
                          onClick={() => scrollToSection(section.id)}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
                            section.level === 1 ? "font-medium" : "pl-6 text-muted-foreground",
                            activeSection === section.id
                              ? "bg-primary/20 text-primary"
                              : "hover:bg-white/5"
                          )}
                        >
                          <span className="line-clamp-2">{section.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>

                  {sections.length === 0 && (
                    <p className="text-sm text-muted-foreground p-3">
                      No sections detected in this document.
                    </p>
                  )}
                </nav>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation FAB */}
      <div className="lg:hidden fixed bottom-20 right-4 z-50">
        <Button
          onClick={() => {
            // Show a simple section list modal on mobile
            const sectionList = sections.map(s => s.title).join('\n')
            const selected = prompt('Jump to section:\n\n' + sectionList + '\n\nEnter section name:')
            if (selected) {
              const section = sections.find(s =>
                s.title.toLowerCase().includes(selected.toLowerCase())
              )
              if (section) scrollToSection(section.id)
            }
          }}
          className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        >
          <List className="h-5 w-5" />
        </Button>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur border border-white/10 hover:bg-white/10 z-50"
          variant="ghost"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
