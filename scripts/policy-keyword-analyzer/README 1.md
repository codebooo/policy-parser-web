# Policy Keyword Analyzer

A tool for analyzing privacy policy documents to extract the most frequent policy-specific terms.
This helps improve the PolicyParser's document detection capabilities.

## Purpose

When the PolicyParser can't find policies through URLs/filenames, it needs to analyze the actual text content.
This tool creates a comprehensive list of policy-specific keywords by:

1. **Analyzing Real Policies**: Processing multiple privacy policy documents from various companies
2. **Filtering Common Words**: Removing standard English words that aren't policy-specific
3. **AI Enhancement**: Using Ollama (deepseek-v3.1:671b-cloud) to categorize and validate keywords
4. **Output Generation**: Creating keyword lists weighted by frequency and relevance

## How It Works

```
┌──────────────────┐
│  Policy Files    │
│  (.txt/.md/.pdf) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Word Counter    │
│  (TypeScript)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Exclude List    │
│  (Common words)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Ollama AI       │
│  (deepseek-v3.1) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Final Keywords  │
│  (JSON output)   │
└──────────────────┘
```

## Usage

### Step 1: Place Policy Files
Put your downloaded privacy policy documents in the `input/` folder:
- `.txt` files
- `.md` files  
- `.html` files

### Step 2: Run the Analyzer
```bash
npx ts-node analyze.ts
```

### Step 3: Review Output
The tool generates:
- `output/word-frequencies.json` - Raw word counts
- `output/policy-keywords.json` - Final AI-validated keyword list
- `output/analysis-report.md` - Human-readable report

## Exclude List

The exclude list (`exclude-words.json`) contains:
- Common English words (the, a, an, is, are, etc.)
- Pronouns (we, you, they, it, etc.)
- Common verbs (have, has, will, would, etc.)
- Prepositions (in, on, at, for, with, etc.)
- Conjunctions (and, or, but, etc.)
- Numbers and single characters

## Output Format

The final `policy-keywords.json` looks like:
```json
{
  "high_confidence": [
    { "term": "personal data", "frequency": 450, "score": 0.95 },
    { "term": "consent", "frequency": 380, "score": 0.92 }
  ],
  "medium_confidence": [...],
  "low_confidence": [...]
}
```

## Requirements

- Node.js 18+
- Ollama installed with `deepseek-v3.1:671b-cloud` model
- At least 10+ policy documents for meaningful results
