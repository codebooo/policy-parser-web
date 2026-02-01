import { createClient } from '@/utils/supabase/server';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Log entry structure for deep logging
 */
export interface DeepLogEntry {
    id: string;
    timestamp: string;
    sessionId: string;
    category: 'identification' | 'discovery' | 'extraction' | 'analysis' | 'search' | 'network' | 'error' | 'system';
    subcategory: string;
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical';
    message: string;
    data?: Record<string, any>;
    duration?: number;
    stackTrace?: string;
    metadata?: {
        domain?: string;
        url?: string;
        strategy?: string;
        httpStatus?: number;
        contentLength?: number;
        userAgent?: string;
        headers?: Record<string, string>;
        responseTime?: number;
    };
}

/**
 * Session context for tracking a complete discovery flow
 */
export interface LogSession {
    sessionId: string;
    startTime: string;
    endTime?: string;
    input: string;
    domain?: string;
    status: 'running' | 'success' | 'failed';
    entries: DeepLogEntry[];
    summary?: {
        totalDuration: number;
        strategiesAttempted: string[];
        httpRequests: number;
        errorsEncountered: number;
        finalResult?: {
            url?: string;
            confidence?: number;
            method?: string;
        };
    };
}

/**
 * Deep Logger class with admin-controlled activation
 */
class DeepLogger {
    private static instance: DeepLogger;
    private enabled: boolean = false;
    private sessions: Map<string, LogSession> = new Map();
    private currentSessionId: string | null = null;
    private logBuffer: DeepLogEntry[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private logDir: string;

    private constructor() {
        this.logDir = path.join(process.cwd(), 'deep_logs');
        // Skip directory initialization on Vercel (read-only filesystem)
        if (!process.env.VERCEL) {
            this.initializeLogDirectory();
        }
    }

    static getInstance(): DeepLogger {
        if (!DeepLogger.instance) {
            DeepLogger.instance = new DeepLogger();
        }
        return DeepLogger.instance;
    }

    private async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (e) {
            // Directory may already exist
        }
    }

    /**
     * Check if deep logging is enabled for the current user
     */
    async isEnabledForUser(): Promise<boolean> {
        try {
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            
            if (!user) return false;
            
            // Check if admin
            const isAdmin = user.email === 'policyparser.admin@gmail.com';
            if (!isAdmin) return false;
            
            // Check user's deep logging preference
            const { data: profile } = await supabase
                .from('profiles')
                .select('deep_logging_enabled')
                .eq('id', user.id)
                .single();
            
            return profile?.deep_logging_enabled ?? false;
        } catch {
            return false;
        }
    }

    /**
     * Enable deep logging (admin only)
     */
    async enable(): Promise<boolean> {
        const enabled = await this.isEnabledForUser();
        if (enabled || process.env.FORCE_DEEP_LOGGING === 'true') {
            this.enabled = true;
            this.startFlushInterval();
            this.log('system', 'init', 'info', 'Deep logging ENABLED');
            return true;
        }
        return false;
    }

    /**
     * Disable deep logging
     */
    disable(): void {
        this.enabled = false;
        this.log('system', 'shutdown', 'info', 'Deep logging DISABLED');
        this.stopFlushInterval();
    }

    /**
     * Force enable for current request (no DB check)
     */
    forceEnable(): void {
        this.enabled = true;
        this.startFlushInterval();
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    private startFlushInterval() {
        if (this.flushInterval) return;
        this.flushInterval = setInterval(() => this.flush(), 5000);
    }

    private stopFlushInterval() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    /**
     * Generate a unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Start a new logging session
     */
    startSession(input: string): string {
        const sessionId = this.generateId();
        const session: LogSession = {
            sessionId,
            startTime: new Date().toISOString(),
            input,
            status: 'running',
            entries: [],
            summary: {
                totalDuration: 0,
                strategiesAttempted: [],
                httpRequests: 0,
                errorsEncountered: 0
            }
        };
        this.sessions.set(sessionId, session);
        this.currentSessionId = sessionId;
        
        this.log('system', 'session_start', 'info', `Started new session for input: ${input}`, {
            input,
            sessionId
        });
        
        return sessionId;
    }

    /**
     * End the current session
     */
    endSession(sessionId: string, status: 'success' | 'failed', result?: any): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.endTime = new Date().toISOString();
        session.status = status;
        
        if (session.summary) {
            session.summary.totalDuration = new Date(session.endTime).getTime() - new Date(session.startTime).getTime();
            if (result) {
                session.summary.finalResult = result;
            }
        }

        this.log('system', 'session_end', status === 'success' ? 'info' : 'error', 
            `Session ended with status: ${status}`, {
                sessionId,
                duration: session.summary?.totalDuration,
                result
            });

        // Save session to file (skip on Vercel - read-only filesystem)
        if (!process.env.VERCEL) {
            this.saveSessionToFile(session);
        }
        
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
        }
    }

    /**
     * Main logging function
     */
    log(
        category: DeepLogEntry['category'],
        subcategory: string,
        level: DeepLogEntry['level'],
        message: string,
        data?: Record<string, any>,
        metadata?: DeepLogEntry['metadata']
    ): void {
        // Always log to console in dev
        const consoleMsg = `[${category}:${subcategory}] ${message}`;
        if (level === 'error' || level === 'critical') {
            console.error(consoleMsg, data);
        } else if (level === 'warn') {
            console.warn(consoleMsg, data);
        } else if (this.enabled) {
            console.log(consoleMsg, data ? JSON.stringify(data).substring(0, 500) : '');
        }

        if (!this.enabled) return;

        const entry: DeepLogEntry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            sessionId: this.currentSessionId || 'no-session',
            category,
            subcategory,
            level,
            message,
            data,
            metadata
        };

        // Add to current session if exists
        if (this.currentSessionId) {
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                session.entries.push(entry);
                
                // Update summary stats
                if (session.summary) {
                    if (category === 'network') {
                        session.summary.httpRequests++;
                    }
                    if (level === 'error' || level === 'critical') {
                        session.summary.errorsEncountered++;
                    }
                    if (category === 'discovery' && subcategory.includes('strategy')) {
                        const strategyName = data?.strategyName || subcategory;
                        if (!session.summary.strategiesAttempted.includes(strategyName)) {
                            session.summary.strategiesAttempted.push(strategyName);
                        }
                    }
                }
            }
        }

        this.logBuffer.push(entry);
    }

    /**
     * Log HTTP request details
     */
    logHttpRequest(
        method: string,
        url: string,
        options?: {
            headers?: Record<string, string>;
            timeout?: number;
            body?: string;
        }
    ): string {
        const requestId = this.generateId();
        this.log('network', 'http_request', 'debug', `${method} ${url}`, {
            requestId,
            method,
            url,
            headers: options?.headers,
            timeout: options?.timeout,
            bodyLength: options?.body?.length
        }, {
            url,
            userAgent: options?.headers?.['User-Agent'],
            headers: options?.headers
        });
        return requestId;
    }

    /**
     * Log HTTP response details
     */
    logHttpResponse(
        requestId: string,
        url: string,
        statusCode: number,
        responseTime: number,
        options?: {
            contentType?: string;
            contentLength?: number;
            headers?: Record<string, string>;
            bodyPreview?: string;
            finalUrl?: string;
        }
    ): void {
        this.log('network', 'http_response', statusCode >= 400 ? 'warn' : 'debug',
            `Response ${statusCode} from ${url} in ${responseTime}ms`, {
                requestId,
                statusCode,
                responseTime,
                contentType: options?.contentType,
                contentLength: options?.contentLength,
                finalUrl: options?.finalUrl,
                redirected: options?.finalUrl !== url,
                bodyPreview: options?.bodyPreview?.substring(0, 200)
            }, {
                url: options?.finalUrl || url,
                httpStatus: statusCode,
                contentLength: options?.contentLength,
                responseTime,
                headers: options?.headers
            });
    }

    /**
     * Log strategy execution
     */
    logStrategy(
        strategyName: string,
        action: 'start' | 'end' | 'found' | 'skip',
        details?: {
            domain?: string;
            candidatesFound?: number;
            confidence?: number;
            url?: string;
            reason?: string;
            duration?: number;
        }
    ): void {
        const level = action === 'found' ? 'info' : 'debug';
        this.log('discovery', `strategy_${action}`, level,
            `Strategy ${strategyName}: ${action}`, {
                strategyName,
                action,
                ...details
            }, {
                domain: details?.domain,
                strategy: strategyName,
                url: details?.url
            });
    }

    /**
     * Log search engine query
     */
    logSearchQuery(
        engine: 'google' | 'bing' | 'duckduckgo',
        query: string,
        results?: {
            success: boolean;
            domain?: string;
            url?: string;
            error?: string;
            responseTime?: number;
        }
    ): void {
        this.log('search', engine, results?.success ? 'info' : 'warn',
            `${engine} search: ${query}`, {
                engine,
                query,
                ...results
            });
    }

    /**
     * Log content extraction
     */
    logExtraction(
        url: string,
        action: 'start' | 'success' | 'failed',
        details?: {
            rawLength?: number;
            cleanedLength?: number;
            markdownLength?: number;
            sectionsFound?: number;
            error?: string;
        }
    ): void {
        this.log('extraction', action, action === 'failed' ? 'error' : 'info',
            `Extraction ${action}: ${url}`, {
                url,
                action,
                ...details
            }, {
                url,
                contentLength: details?.rawLength
            });
    }

    /**
     * Log identification step
     */
    logIdentification(
        step: 'normalize' | 'resolve' | 'dns' | 'parse',
        input: string,
        output?: any,
        error?: string
    ): void {
        this.log('identification', step, error ? 'error' : 'debug',
            `Identification ${step}: ${input} -> ${JSON.stringify(output)}`, {
                step,
                input,
                output,
                error
            });
    }

    /**
     * Log error with stack trace
     */
    logError(
        category: DeepLogEntry['category'],
        operation: string,
        error: Error | any,
        context?: Record<string, any>
    ): void {
        const entry: DeepLogEntry = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            sessionId: this.currentSessionId || 'no-session',
            category,
            subcategory: operation,
            level: 'error',
            message: error?.message || String(error),
            data: {
                ...context,
                errorName: error?.name,
                errorCode: error?.code
            },
            stackTrace: error?.stack
        };

        if (this.currentSessionId) {
            const session = this.sessions.get(this.currentSessionId);
            if (session) {
                session.entries.push(entry);
                if (session.summary) {
                    session.summary.errorsEncountered++;
                }
            }
        }

        this.logBuffer.push(entry);
        console.error(`[DEEP_LOG ERROR] ${operation}:`, error);
    }

    /**
     * Flush log buffer to file
     */
    private async flush(): Promise<void> {
        if (this.logBuffer.length === 0) return;
        // Skip file operations on Vercel (read-only filesystem)
        if (process.env.VERCEL) {
            this.logBuffer = [];
            return;
        }

        const entries = [...this.logBuffer];
        this.logBuffer = [];

        const dateStr = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `deep_log_${dateStr}.jsonl`);

        try {
            const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
            await fs.appendFile(logFile, lines);
        } catch (e) {
            console.error('Failed to flush logs:', e);
            // Re-add entries to buffer
            this.logBuffer.unshift(...entries);
        }
    }

    /**
     * Save complete session to file
     */
    private async saveSessionToFile(session: LogSession): Promise<void> {
        const sessionFile = path.join(this.logDir, `session_${session.sessionId}.json`);
        try {
            await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
        } catch (e) {
            console.error('Failed to save session:', e);
        }
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): LogSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all recent sessions
     */
    async getRecentSessions(limit: number = 20): Promise<LogSession[]> {
        try {
            const files = await fs.readdir(this.logDir);
            const sessionFiles = files
                .filter(f => f.startsWith('session_') && f.endsWith('.json'))
                .sort()
                .reverse()
                .slice(0, limit);

            const sessions: LogSession[] = [];
            for (const file of sessionFiles) {
                try {
                    const content = await fs.readFile(path.join(this.logDir, file), 'utf-8');
                    sessions.push(JSON.parse(content));
                } catch {
                    // Skip invalid files
                }
            }
            return sessions;
        } catch {
            return [];
        }
    }

    /**
     * Get logs for a specific date
     */
    async getLogsForDate(date: string): Promise<DeepLogEntry[]> {
        const logFile = path.join(this.logDir, `deep_log_${date}.jsonl`);
        try {
            const content = await fs.readFile(logFile, 'utf-8');
            return content
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        } catch {
            return [];
        }
    }

    /**
     * Create a timing helper
     */
    time(label: string): () => number {
        const start = performance.now();
        this.log('system', 'timer_start', 'trace', `Timer started: ${label}`, { label });
        
        return () => {
            const duration = Math.round(performance.now() - start);
            this.log('system', 'timer_end', 'trace', `Timer ended: ${label} (${duration}ms)`, { 
                label, 
                duration 
            });
            return duration;
        };
    }
}

// Export singleton instance
export const deepLogger = DeepLogger.getInstance();

// Convenience functions
export const startDeepLogging = () => deepLogger.enable();
export const stopDeepLogging = () => deepLogger.disable();
export const forceDeepLogging = () => deepLogger.forceEnable();
export const isDeepLoggingEnabled = () => deepLogger.isEnabled();
