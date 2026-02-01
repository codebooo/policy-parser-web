"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { findAndFetchPolicy } from "@/app/actions";
import { saveTestLog } from "@/app/testActions";
import { CheckCircle2, XCircle, Loader2, Save } from "lucide-react";

const COMPANIES = [
    "Google", "Facebook", "Amazon", "Apple", "Microsoft", "Netflix", "Spotify", "Twitter", "Instagram", "LinkedIn",
    "TikTok", "Uber", "Airbnb", "OpenAI", "Anthropic", "Perplexity", "Discord", "Slack", "Zoom", "Reddit",
    "Pinterest", "Snapchat", "WhatsApp", "Telegram", "Signal", "Dropbox", "Salesforce", "Adobe", "Oracle", "IBM",
    "Intel", "AMD", "Nvidia", "Samsung", "Sony", "Nintendo", "PlayStation", "Xbox", "Steam", "Epic Games",
    "Shopify", "Etsy", "eBay", "Walmart", "Target", "Best Buy", "Costco", "Home Depot", "Lowe's", "IKEA",
    "Nike", "Adidas", "H&M", "Zara", "Uniqlo", "Gap", "Levi's", "Lululemon", "Under Armour", "Puma",
    "Coca-Cola", "Pepsi", "McDonald's", "Starbucks", "Burger King", "KFC", "Subway", "Domino's", "Pizza Hut", "Chipotle",
    "Toyota", "Honda", "Ford", "Chevrolet", "Tesla", "BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Porsche",
    "Delta", "United Airlines", "American Airlines", "Southwest", "JetBlue", "British Airways", "Lufthansa", "Emirates", "Qatar Airways", "Air France",
    "Marriott", "Hilton", "Hyatt", "Airbnb", "Booking.com", "Expedia", "TripAdvisor", "Yelp", "Zillow", "Redfin"
];

export default function TestPawdPage() {
    const [results, setResults] = useState<any[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logPath, setLogPath] = useState<string | null>(null);

    const runTest = async () => {
        setIsRunning(true);
        setResults([]);
        setLogPath(null);
        setProgress(0);

        const testResults = [];

        for (let i = 0; i < COMPANIES.length; i++) {
            const company = COMPANIES[i];
            const start = Date.now();

            try {
                const result = await findAndFetchPolicy(company);
                const duration = Date.now() - start;

                let entry;
                if (result.success) {
                    entry = {
                        company,
                        success: true,
                        url: result.url,
                        date: result.date,
                        error: undefined,
                        duration
                    };
                } else {
                    entry = {
                        company,
                        success: false,
                        url: undefined,
                        date: undefined,
                        error: result.error,
                        duration
                    };
                }

                testResults.push(entry);
                setResults(prev => [...prev, entry]);
            } catch (e: any) {
                const entry = {
                    company,
                    success: false,
                    error: e.message,
                    duration: Date.now() - start
                };
                testResults.push(entry);
                setResults(prev => [...prev, entry]);
            }

            setProgress(Math.round(((i + 1) / COMPANIES.length) * 100));
        }

        setIsRunning(false);

        // Auto save log
        const successCount = testResults.filter(r => r.success).length;
        const logData = {
            timestamp: new Date().toISOString(),
            total: COMPANIES.length,
            successCount,
            successRate: `${successCount}%`,
            results: testResults
        };

        const saveResult = await saveTestLog(logData);
        if (saveResult.success && saveResult.path) {
            setLogPath(saveResult.path);
        }
    };

    const successCount = results.filter(r => r.success).length;
    const successRate = results.length > 0 ? Math.round((successCount / results.length) * 100) : 0;

    return (
        <div className="container mx-auto py-10 px-4 max-w-5xl">
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="text-3xl flex justify-between items-center">
                        PAWD Automated Test Suite
                        <Button onClick={runTest} disabled={isRunning} size="lg">
                            {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {isRunning ? "Running Test..." : "Start 100-Company Test"}
                        </Button>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                        <div className="p-4 bg-background/50 rounded-lg border">
                            <div className="text-sm text-muted-foreground">Progress</div>
                            <div className="text-2xl font-bold">{progress}%</div>
                        </div>
                        <div className="p-4 bg-background/50 rounded-lg border">
                            <div className="text-sm text-muted-foreground">Success Rate</div>
                            <div className={`text-2xl font-bold ${successRate >= 99 ? "text-green-500" : "text-yellow-500"}`}>
                                {successRate}%
                            </div>
                        </div>
                        <div className="p-4 bg-background/50 rounded-lg border">
                            <div className="text-sm text-muted-foreground">Analyzed</div>
                            <div className="text-2xl font-bold">{results.length}/{COMPANIES.length}</div>
                        </div>
                    </div>

                    {logPath && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 mb-4">
                            <Save className="h-4 w-4" />
                            Log saved to: {logPath}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-2">
                {results.map((res, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${res.success ? "bg-green-500/5 border-green-500/10" : "bg-red-500/5 border-red-500/10"}`}>
                        <div className="flex items-center gap-3">
                            {res.success ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                            <span className="font-medium w-32">{res.company}</span>
                            {res.url && <a href={res.url} target="_blank" className="text-xs text-muted-foreground hover:text-primary truncate max-w-md">{res.url}</a>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {res.date && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{res.date}</span>}
                            <span>{res.duration}ms</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
