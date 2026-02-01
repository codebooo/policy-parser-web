'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { logger } from './logger';

// Store path - in the project root's data folder
const DATA_DIR = path.join(process.cwd(), 'data');
const ANALYSES_FILE = path.join(DATA_DIR, 'analyses.json');

export interface AnalysisLogEntry {
    id: string;
    domain: string;
    url: string | null;
    timestamp: string;
    success: boolean;
    error?: string;
    score?: number;
    policyType?: string;
    analysisTimeMs?: number;
    feedbackType?: 'positive' | 'negative' | null;
    feedbackUrl?: string | null;
    feedbackAt?: string | null;
}

/**
 * Ensure the data directory exists
 */
async function ensureDataDir(): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {
        // Directory may already exist
    }
}

/**
 * Read all analysis logs from file
 */
async function readLogs(): Promise<AnalysisLogEntry[]> {
    if (process.env.VERCEL) return []; // No logs on Vercel
    await ensureDataDir();
    try {
        const content = await fs.readFile(ANALYSES_FILE, 'utf-8');
        return JSON.parse(content) as AnalysisLogEntry[];
    } catch (e) {
        // File doesn't exist yet
        return [];
    }
}

/**
 * Write logs to file
 */
async function writeLogs(logs: AnalysisLogEntry[]): Promise<void> {
    if (process.env.VERCEL) return; // No-op on Vercel (Read-only FS)
    await ensureDataDir();
    await fs.writeFile(ANALYSES_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

/**
 * Generate unique ID
 */
function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log a new analysis result
 */
export async function logAnalysis(entry: Omit<AnalysisLogEntry, 'id'>): Promise<string> {
    try {
        const logs = await readLogs();
        const id = generateId();

        const newEntry: AnalysisLogEntry = {
            id,
            ...entry
        };

        logs.unshift(newEntry); // Add to beginning (newest first)

        // Keep only last 1000 entries to prevent file bloat
        const trimmedLogs = logs.slice(0, 1000);

        await writeLogs(trimmedLogs);

        logger.info(`[AnalysisStore] Logged analysis for ${entry.domain} (success: ${entry.success})`);

        return id;
    } catch (error: any) {
        logger.error('[AnalysisStore] Failed to log analysis', error);
        return '';
    }
}

/**
 * Update feedback for an analysis
 */
export async function updateAnalysisFeedback(
    domain: string,
    feedbackType: 'positive' | 'negative',
    feedbackUrl?: string
): Promise<boolean> {
    try {
        const logs = await readLogs();

        // Find the most recent analysis for this domain
        const entryIndex = logs.findIndex(log => log.domain === domain);

        if (entryIndex === -1) {
            logger.warn(`[AnalysisStore] No analysis found for domain: ${domain}`);
            return false;
        }

        logs[entryIndex].feedbackType = feedbackType;
        logs[entryIndex].feedbackUrl = feedbackUrl || null;
        logs[entryIndex].feedbackAt = new Date().toISOString();

        await writeLogs(logs);

        logger.info(`[AnalysisStore] Updated feedback for ${domain}: ${feedbackType}`);

        return true;
    } catch (error: any) {
        logger.error('[AnalysisStore] Failed to update feedback', error);
        return false;
    }
}

/**
 * Get all analysis logs with optional filtering
 */
export async function getAnalysisLogs(options?: {
    limit?: number;
    onlyFailures?: boolean;
    onlyWithFeedback?: boolean;
    domain?: string;
}): Promise<AnalysisLogEntry[]> {
    try {
        let logs = await readLogs();

        if (options?.onlyFailures) {
            logs = logs.filter(log => !log.success);
        }

        if (options?.onlyWithFeedback) {
            logs = logs.filter(log => log.feedbackType !== null && log.feedbackType !== undefined);
        }

        if (options?.domain) {
            logs = logs.filter(log => log.domain.includes(options.domain!));
        }

        if (options?.limit) {
            logs = logs.slice(0, options.limit);
        }

        return logs;
    } catch (error: any) {
        logger.error('[AnalysisStore] Failed to get logs', error);
        return [];
    }
}

/**
 * Get analysis statistics
 */
export async function getAnalysisStats(): Promise<{
    total: number;
    successful: number;
    failed: number;
    positiveFeedback: number;
    negativeFeedback: number;
    avgScore: number | null;
}> {
    try {
        const logs = await readLogs();

        const successful = logs.filter(log => log.success).length;
        const failed = logs.filter(log => !log.success).length;
        const positiveFeedback = logs.filter(log => log.feedbackType === 'positive').length;
        const negativeFeedback = logs.filter(log => log.feedbackType === 'negative').length;

        const scoresArray = logs
            .filter(log => log.score !== undefined && log.score !== null)
            .map(log => log.score!);

        const avgScore = scoresArray.length > 0
            ? Math.round(scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length)
            : null;

        return {
            total: logs.length,
            successful,
            failed,
            positiveFeedback,
            negativeFeedback,
            avgScore
        };
    } catch (error: any) {
        logger.error('[AnalysisStore] Failed to get stats', error);
        return {
            total: 0,
            successful: 0,
            failed: 0,
            positiveFeedback: 0,
            negativeFeedback: 0,
            avgScore: null
        };
    }
}
