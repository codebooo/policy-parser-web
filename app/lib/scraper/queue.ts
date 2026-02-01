import { createClient } from '@/utils/supabase/server';
import { logger } from '../logger';

export interface QueueItem {
    id: string;
    domain: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    created_at: string;
    updated_at: string;
}

/**
 * Add domains to the scraping queue
 */
export async function addToQueue(domains: string[]): Promise<{ success: boolean; count: number; error?: string }> {
    const supabase = await createClient();

    // Filter duplicates (simple check)
    const uniqueDomains = [...new Set(domains.map(d => d.trim().toLowerCase()).filter(d => d))];

    if (uniqueDomains.length === 0) return { success: true, count: 0 };

    try {
        const { error } = await supabase
            .from('scraping_queue')
            .insert(uniqueDomains.map(domain => ({
                domain,
                status: 'pending'
            })));

        if (error) throw error;

        logger.info(`[Queue] Added ${uniqueDomains.length} domains to queue`);
        return { success: true, count: uniqueDomains.length };
    } catch (error: any) {
        logger.error('[Queue] Add failed', error);
        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Get the next pending item and lock it (mark as processing)
 */
export async function getNextQueueItem(): Promise<QueueItem | null> {
    const supabase = await createClient();

    try {
        // Find one pending item
        // Note: This is a simple implementation. For high concurrency, use a stored procedure or 'for update skip locked'
        const { data: items, error } = await supabase
            .from('scraping_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(1);

        if (error) throw error;
        if (!items || items.length === 0) return null;

        const item = items[0];

        // Mark as processing
        const { error: updateError } = await supabase
            .from('scraping_queue')
            .update({ status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', item.id);

        if (updateError) throw updateError;

        return { ...item, status: 'processing' };
    } catch (error: any) {
        logger.error('[Queue] Get next failed', error);
        return null;
    }
}

/**
 * Update the status of a queue item
 */
export async function updateQueueStatus(
    id: string,
    status: 'completed' | 'failed',
    result?: any
): Promise<void> {
    const supabase = await createClient();

    try {
        await supabase
            .from('scraping_queue')
            .update({
                status,
                result,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
    } catch (error) {
        logger.error(`[Queue] Update status failed for ${id}`, error);
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    const supabase = await createClient();

    // This is inefficient for large tables but fine for this scale
    const { data, error } = await supabase
        .from('scraping_queue')
        .select('status');

    if (error || !data) return { pending: 0, processing: 0, completed: 0, failed: 0 };

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    data.forEach((row: any) => {
        if (row.status in stats) {
            stats[row.status as keyof typeof stats]++;
        }
    });

    return stats;
}
