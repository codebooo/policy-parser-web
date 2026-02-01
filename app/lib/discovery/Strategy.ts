import { PolicyCandidate } from '../types/policy';

export interface DiscoveryStrategy {
    name: string;
    execute(domain: string): Promise<PolicyCandidate[]>;
}
