'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * Educational Disclaimer Component
 * 
 * LEGAL NOTE: This disclaimer is displayed prominently on all analysis results
 * to clarify that PolicyParser provides educational summaries only, NOT legal advice.
 * This is intentional to avoid unauthorized practice of law concerns.
 */
export function EducationalDisclaimer() {
    return (
        <div className="w-full p-4 mb-6 rounded-lg bg-amber-900/20 border border-amber-600/30">
            <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-300">
                        Educational Summary Only
                    </p>
                    <p className="text-xs text-amber-200/80 leading-relaxed">
                        This is an AI-generated summary for educational purposes. It is <strong>NOT legal advice</strong>.
                        This analysis may contain errors or omissions. Always read the original policy and consult
                        a qualified attorney for legal matters.
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Compact version for inline use
 */
export function EducationalDisclaimerCompact() {
    return (
        <p className="text-xs text-muted-foreground italic mt-2">
            ⚠️ Educational summary only, not legal advice. May contain errors.
        </p>
    );
}
