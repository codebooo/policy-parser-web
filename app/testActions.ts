"use server";

import fs from "fs";
import path from "path";

export async function saveTestLog(logData: any) {
    // Skip file operations on Vercel (read-only filesystem)
    if (process.env.VERCEL) {
        console.log("[testActions] Skipping file save on Vercel:", JSON.stringify(logData));
        return { success: true, path: "(skipped on Vercel)" };
    }

    try {
        const logDir = path.join(process.cwd(), "logs");
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `pawd_test_${timestamp}.json`;
        const filePath = path.join(logDir, filename);

        fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
        return { success: true, path: filePath };
    } catch (error: any) {
        console.error("Failed to save log:", error);
        return { success: false, error: error.message };
    }
}
