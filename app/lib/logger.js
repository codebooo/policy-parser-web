"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Enable deep logging by default - logs will be saved to the deep_logs folder
const DEEP_LOG_ENABLED = true;
const DEEP_LOGS_DIR = path_1.default.join(process.cwd(), 'deep_logs');
// Ensure the deep_logs directory exists
function ensureLogDir() {
    try {
        if (!fs_1.default.existsSync(DEEP_LOGS_DIR)) {
            fs_1.default.mkdirSync(DEEP_LOGS_DIR, { recursive: true });
        }
    }
    catch (e) {
        // Ignore errors in creating directory (might be in readonly environment)
    }
}
// Get current date for log file naming
function getLogFileName() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    return `log_${dateStr}.json`;
}
// Append log entry to file
function appendToLogFile(entry) {
    if (!DEEP_LOG_ENABLED)
        return;
    try {
        ensureLogDir();
        const logFile = path_1.default.join(DEEP_LOGS_DIR, getLogFileName());
        // Read existing logs or create new array
        let logs = [];
        if (fs_1.default.existsSync(logFile)) {
            try {
                const content = fs_1.default.readFileSync(logFile, 'utf-8');
                logs = JSON.parse(content);
            }
            catch {
                logs = [];
            }
        }
        // Append new entry
        logs.push(entry);
        // Write back (limit to last 1000 entries per day to prevent huge files)
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        fs_1.default.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    }
    catch (e) {
        // Silent fail for logging - don't break the app
    }
}
class Logger {
    constructor() {
        this.logs = [];
    }
    log(level, message, data) {
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
    info(message, data) { this.log('info', message, data); }
    warn(message, data) { this.log('warn', message, data); }
    error(message, data) { this.log('error', message, data); }
    debug(message, data) { this.log('debug', message, data); }
    getLogs() {
        return this.logs;
    }
}
exports.logger = new Logger();
