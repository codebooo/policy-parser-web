# PolicyParser

AI-powered privacy policy analyzer that helps users understand what companies do with their data.

## Features

### Core Features
- **Policy Discovery** - Intelligent crawling to find privacy policies, terms of service, and other legal documents
- **AI Analysis** - Uses Google Gemini to analyze legal documents and extract key insights
- **Privacy Scoring** - 0-100 score based on data collection, sharing practices, and user rights
- **Risk Assessment** - Categorized findings (Threat, Warning, Caution, Normal, Good, Brilliant)

### Pro Features
- **Comprehensive Analysis** - Analyze all company policies in one click
- **Policy Tracking** - Get notified when tracked policies change
- **Version History** - View historical versions of analyzed policies
- **Version Comparison** - Compare any two versions to see what changed
- **Caching System** - Saves API credits by caching analyses

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Pro
- **Authentication**: Supabase Auth

## Getting Started

First, set up your environment variables in `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Migrations

Run the Supabase migrations to set up the database schema:

```bash
# Using Supabase CLI
supabase db push

# Or run migrations manually in Supabase Dashboard
```

## Project Structure

```
app/
├── actions.ts              # Server actions: scraping, AI analysis
├── versionActions.ts       # Policy caching & version management
├── analyze/                # Analysis page
├── lib/
│   ├── discovery/          # Intelligent policy discovery engine
│   ├── extractor/          # Content extraction
│   └── analyzer/           # AI analysis logic

components/
├── PolicyVersions.tsx      # Version history UI
├── Navbar.tsx
└── ui/                     # Reusable components

supabase/
└── migrations/             # Database migrations
```

## Recent Updates

### November 30, 2025 - Policy Caching & Version History
- Added `policy_versions` table for caching analyses
- Implemented cache-first analysis to save API credits
- Created version history UI for Pro users
- Added version comparison with diff viewer
- Improved policy discovery with content validation

## License

MIT
