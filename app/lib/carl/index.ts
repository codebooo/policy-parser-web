/**
 * Carl - The PolicyParser Neural Network
 * 
 * Carl is an intelligent neural network designed to detect privacy policies
 * and terms of service pages with high accuracy. He learns from training
 * examples and remembers past decisions to improve over time.
 * 
 * Usage:
 * ```typescript
 * import { getCarl, extractCarlFeatures } from '@/app/lib/carl';
 * 
 * // Get Carl instance
 * const carl = await getCarl();
 * 
 * // Extract features from a link
 * const features = extractCarlFeatures(linkText, href, 'footer', baseUrl);
 * 
 * // Get prediction
 * const prediction = carl.predict(features);
 * console.log(prediction.isPolicy, prediction.confidence);
 * 
 * // Train Carl on correct/incorrect examples
 * await carl.train(features, 1, 'example.com', 'https://example.com/privacy');
 * ```
 */

// Main Carl class
export { Carl, getCarl, CARL_CONFIG } from './Carl';
export type { TrainingExample, CarlPrediction } from './Carl';

// Feature extraction
export { 
    extractCarlFeatures, 
    extractUrlFeatures,
    getCarlFeatureNames,
    CARL_FEATURE_COUNT,
    PRIVACY_KEYWORDS,
    TERMS_KEYWORDS,
    COOKIE_KEYWORDS,
    LEGAL_HUB_KEYWORDS,
    POLICY_URL_PATTERNS
} from './FeatureExtractor';

// Matrix operations (for advanced usage/debugging)
export { Matrix } from './Matrix';
