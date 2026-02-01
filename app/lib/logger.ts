import fs from 'fs';
import path from 'path';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// Enable deep logging by default - logs will be saved to the deep_logs folder
const DEEP_LOG_ENABLED = true;
const DEEP_LOGS_DIR = path.join(process.cwd(), 'deep_logs');

// Ensure the deep_logs directory exists
function ensureLogDir() {
    try {
        if (!fs.existsSync(DEEP_LOGS_DIR)) {
            fs.mkdirSync(DEEP_LOGS_DIR, { recursive: true });
        }
    } catch (e) {
        // Ignore errors in creating directory (might be in readonly environment)
    }
}

// Get current date for log file naming
function getLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return `log_${dateStr}.json`;
}

// Append log entry to file
function appendToLogFile(entry: any) {
    if (!DEEP_LOG_ENABLED || process.env.VERCEL) return;

    try {
        ensureLogDir();
        const logFile = path.join(DEEP_LOGS_DIR, getLogFileName());

        // Read existing logs or create new array
        let logs: any[] = [];
        if (fs.existsSync(logFile)) {
            try {
                const content = fs.readFileSync(logFile, 'utf-8');
                logs = JSON.parse(content);
            } catch {
                logs = [];
            }
        }

        // Append new entry
        logs.push(entry);

        // Write back (limit to last 1000 entries per day to prevent huge files)
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }

        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (e) {
        // Silent fail for logging - don't break the app
    }
}

class Logger {
    private logs: any[] = [];

    log(level: LogLevel, message: string, data?: any) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data: data ? (data instanceof Error ? { message: data.message, stack: data.stack } : data) : undefined
        };

        // Print to stdout for Vercel logs
        console.log(JSON.stringify(entry));

        // Store in memory
        this.logs.push(entry);

        // Save to file if deep logging is enabled
        appendToLogFile(entry);
    }

    info(message: string, data?: any) { this.log('info', message, data); }
    warn(message: string, data?: any) { this.log('warn', message, data); }
    error(message: string, data?: any) { this.log('error', message, data); }
    debug(message: string, data?: any) { this.log('debug', message, data); }

    getLogs() {
        return this.logs;
    }
}

export const logger = new Logger();
