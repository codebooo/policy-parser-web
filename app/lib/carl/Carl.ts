/**
 * ██████╗ █████╗ ██████╗ ██╗     
 * ██╔════╝██╔══██╗██╔══██╗██║     
 * ██║     ███████║██████╔╝██║     
 * ██║     ██╔══██║██╔══██╗██║     
 * ╚██████╗██║  ██║██║  ██║███████╗
 *  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
 * 
 * Carl - The PolicyParser Neural Network
 * 
 * A multilayer perceptron (MLP) neural network designed to classify URLs
 * and links as privacy policies or not. Carl learns from training examples
 * and improves over time.
 * 
 * Architecture: Input(24) -> Hidden1(32) -> Hidden2(16) -> Output(1)
 * Activation: Sigmoid
 * Learning: Backpropagation with gradient descent
 * 
 * Based on "Make Your Own Neural Network" by Tariq Rashid
 */

import { Matrix } from './Matrix';
import { CARL_FEATURE_COUNT } from './FeatureExtractor';
import { createClient } from '@/utils/supabase/server';
import { logger } from '../logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Carl's architecture configuration */
const CARL_CONFIG = {
    inputNodes: CARL_FEATURE_COUNT,  // 24 features
    hidden1Nodes: 32,                 // First hidden layer
    hidden2Nodes: 16,                 // Second hidden layer
    outputNodes: 1,                   // Binary classification
    learningRate: 0.15,               // Learning rate (η)
    momentum: 0.9,                    // Momentum for SGD
    maxTrainingExamples: 10000,       // Max stored training examples
    modelId: 'carl_v1'                // Model identifier
};

// ============================================================================
// INTERFACES
// ============================================================================

/** Training example stored for retraining */
export interface TrainingExample {
    id: string;
    features: number[];
    target: number;        // 1 = is policy, 0 = not policy
    domain: string;        // Source domain for debugging
    url: string;           // URL that was classified
    createdAt: string;
    feedback?: 'positive' | 'negative';  // User feedback
}

/** Serialized model weights for persistence */
interface CarlWeights {
    w_ih1: number[][];     // Input -> Hidden1
    w_h1h2: number[][];    // Hidden1 -> Hidden2
    w_h2o: number[][];     // Hidden2 -> Output
    b_h1: number[][];      // Bias Hidden1
    b_h2: number[][];      // Bias Hidden2
    b_o: number[][];       // Bias Output
}

/** Complete Carl model state */
interface CarlModelState {
    weights: CarlWeights;
    generation: number;
    trainingCount: number;
    accuracy: number;      // Last measured accuracy
    lastTrainedAt: string;
    version: string;
}

/** Prediction result with confidence */
export interface CarlPrediction {
    score: number;              // 0-1 probability
    isPolicy: boolean;          // score > 0.5
    confidence: 'high' | 'medium' | 'low';
    features: number[];
    generation: number;
}

// ============================================================================
// CARL NEURAL NETWORK CLASS
// ============================================================================

export class Carl {
    // Layer weights
    private w_ih1: Matrix;    // Input -> Hidden1
    private w_h1h2: Matrix;   // Hidden1 -> Hidden2  
    private w_h2o: Matrix;    // Hidden2 -> Output
    
    // Biases
    private b_h1: Matrix;
    private b_h2: Matrix;
    private b_o: Matrix;
    
    // Momentum (velocity) for SGD with momentum
    private v_w_ih1: Matrix;
    private v_w_h1h2: Matrix;
    private v_w_h2o: Matrix;
    private v_b_h1: Matrix;
    private v_b_h2: Matrix;
    private v_b_o: Matrix;
    
    // Training state
    public generation: number = 0;
    public trainingCount: number = 0;
    public accuracy: number = 0;
    public lastTrainedAt: string = '';
    
    private isInitialized: boolean = false;
    private learningRate: number;
    private momentum: number;

    constructor() {
        this.learningRate = CARL_CONFIG.learningRate;
        this.momentum = CARL_CONFIG.momentum;
        
        // Initialize weight matrices with proper dimensions
        this.w_ih1 = new Matrix(CARL_CONFIG.hidden1Nodes, CARL_CONFIG.inputNodes);
        this.w_h1h2 = new Matrix(CARL_CONFIG.hidden2Nodes, CARL_CONFIG.hidden1Nodes);
        this.w_h2o = new Matrix(CARL_CONFIG.outputNodes, CARL_CONFIG.hidden2Nodes);
        
        // Initialize biases
        this.b_h1 = new Matrix(CARL_CONFIG.hidden1Nodes, 1);
        this.b_h2 = new Matrix(CARL_CONFIG.hidden2Nodes, 1);
        this.b_o = new Matrix(CARL_CONFIG.outputNodes, 1);
        
        // Initialize velocity matrices for momentum (zeros)
        this.v_w_ih1 = new Matrix(CARL_CONFIG.hidden1Nodes, CARL_CONFIG.inputNodes);
        this.v_w_h1h2 = new Matrix(CARL_CONFIG.hidden2Nodes, CARL_CONFIG.hidden1Nodes);
        this.v_w_h2o = new Matrix(CARL_CONFIG.outputNodes, CARL_CONFIG.hidden2Nodes);
        this.v_b_h1 = new Matrix(CARL_CONFIG.hidden1Nodes, 1);
        this.v_b_h2 = new Matrix(CARL_CONFIG.hidden2Nodes, 1);
        this.v_b_o = new Matrix(CARL_CONFIG.outputNodes, 1);
        
        // Randomize weights (using He initialization variant)
        this.initializeWeights();
    }

    /**
     * Initialize weights using proper distribution
     * As recommended in the book: sample from normal distribution
     * with standard deviation = 1/sqrt(incoming_connections)
     */
    private initializeWeights(): void {
        this.w_ih1.randomize(CARL_CONFIG.inputNodes);
        this.w_h1h2.randomize(CARL_CONFIG.hidden1Nodes);
        this.w_h2o.randomize(CARL_CONFIG.hidden2Nodes);
        
        // Biases start at zero
        this.b_h1 = new Matrix(CARL_CONFIG.hidden1Nodes, 1);
        this.b_h2 = new Matrix(CARL_CONFIG.hidden2Nodes, 1);
        this.b_o = new Matrix(CARL_CONFIG.outputNodes, 1);
    }

    /**
     * Sigmoid activation function
     * σ(x) = 1 / (1 + e^(-x))
     */
    private sigmoid(x: number): number {
        // Clamp to prevent overflow
        const clampedX = Math.max(-500, Math.min(500, x));
        return 1 / (1 + Math.exp(-clampedX));
    }

    /**
     * Derivative of sigmoid for backpropagation
     * σ'(x) = σ(x) * (1 - σ(x))
     * Since we already have σ(x), we compute: y * (1 - y)
     */
    private dsigmoid(y: number): number {
        return y * (1 - y);
    }

    // ========================================================================
    // FORWARD PROPAGATION (Query/Predict)
    // ========================================================================

    /**
     * Query the network - forward pass to get prediction
     * @param inputArray - Feature vector (24 values)
     * @returns Score between 0-1
     */
    query(inputArray: number[]): number {
        if (inputArray.length !== CARL_CONFIG.inputNodes) {
            throw new Error(`Carl expects ${CARL_CONFIG.inputNodes} features, got ${inputArray.length}`);
        }

        // Convert input array to matrix
        const inputs = Matrix.fromArray(inputArray);

        // Hidden Layer 1
        // H1 = σ(W_ih1 · I + B_h1)
        const h1_raw = Matrix.dot(this.w_ih1, inputs);
        h1_raw.add(this.b_h1);
        const h1 = Matrix.map(h1_raw, (x) => this.sigmoid(x));

        // Hidden Layer 2
        // H2 = σ(W_h1h2 · H1 + B_h2)
        const h2_raw = Matrix.dot(this.w_h1h2, h1);
        h2_raw.add(this.b_h2);
        const h2 = Matrix.map(h2_raw, (x) => this.sigmoid(x));

        // Output Layer
        // O = σ(W_h2o · H2 + B_o)
        const o_raw = Matrix.dot(this.w_h2o, h2);
        o_raw.add(this.b_o);
        const output = Matrix.map(o_raw, (x) => this.sigmoid(x));

        // Return single output value
        return output.data[0][0];
    }

    /**
     * Predict with full result object
     */
    predict(features: number[]): CarlPrediction {
        const score = this.query(features);
        
        // Determine confidence based on distance from 0.5
        const distance = Math.abs(score - 0.5);
        let confidence: 'high' | 'medium' | 'low';
        if (distance > 0.35) confidence = 'high';
        else if (distance > 0.15) confidence = 'medium';
        else confidence = 'low';

        return {
            score,
            isPolicy: score > 0.5,
            confidence,
            features,
            generation: this.generation
        };
    }

    // ========================================================================
    // BACKPROPAGATION (Training)
    // ========================================================================

    /**
     * Train on a single example using backpropagation
     * @param inputArray - Feature vector
     * @param target - Target value (1 for policy, 0 for not)
     */
    trainSingle(inputArray: number[], target: number): void {
        if (inputArray.length !== CARL_CONFIG.inputNodes) {
            throw new Error(`Carl expects ${CARL_CONFIG.inputNodes} features, got ${inputArray.length}`);
        }

        // ======== FORWARD PASS (store activations for backprop) ========
        const inputs = Matrix.fromArray(inputArray);

        // Hidden Layer 1
        const h1_raw = Matrix.dot(this.w_ih1, inputs);
        h1_raw.add(this.b_h1);
        const h1 = Matrix.map(h1_raw, (x) => this.sigmoid(x));

        // Hidden Layer 2
        const h2_raw = Matrix.dot(this.w_h1h2, h1);
        h2_raw.add(this.b_h2);
        const h2 = Matrix.map(h2_raw, (x) => this.sigmoid(x));

        // Output
        const o_raw = Matrix.dot(this.w_h2o, h2);
        o_raw.add(this.b_o);
        const outputs = Matrix.map(o_raw, (x) => this.sigmoid(x));

        // ======== BACKWARD PASS ========
        const targets = Matrix.fromArray([target]);

        // Output layer errors: E_o = T - O
        const output_errors = Matrix.subtract(targets, outputs);

        // Output layer gradients: G_o = E_o * O * (1-O) * lr
        const output_gradients = Matrix.map(outputs, (y) => this.dsigmoid(y));
        output_gradients.multiply(output_errors);
        output_gradients.multiply(this.learningRate);

        // Calculate W_h2o deltas: ΔW = G_o · H2^T
        const h2_T = Matrix.transpose(h2);
        const w_h2o_deltas = Matrix.dot(output_gradients, h2_T);

        // Update W_h2o with momentum
        this.v_w_h2o.multiply(this.momentum);
        this.v_w_h2o.add(w_h2o_deltas);
        this.w_h2o.add(this.v_w_h2o);
        
        // Update output bias
        this.v_b_o.multiply(this.momentum);
        this.v_b_o.add(output_gradients);
        this.b_o.add(this.v_b_o);

        // -------- Hidden Layer 2 --------
        // Backpropagate errors: E_h2 = W_h2o^T · E_o
        const w_h2o_T = Matrix.transpose(this.w_h2o);
        const h2_errors = Matrix.dot(w_h2o_T, output_errors);

        // Hidden2 gradients
        const h2_gradients = Matrix.map(h2, (y) => this.dsigmoid(y));
        h2_gradients.multiply(h2_errors);
        h2_gradients.multiply(this.learningRate);

        // Calculate W_h1h2 deltas
        const h1_T = Matrix.transpose(h1);
        const w_h1h2_deltas = Matrix.dot(h2_gradients, h1_T);

        // Update W_h1h2 with momentum
        this.v_w_h1h2.multiply(this.momentum);
        this.v_w_h1h2.add(w_h1h2_deltas);
        this.w_h1h2.add(this.v_w_h1h2);
        
        // Update hidden2 bias
        this.v_b_h2.multiply(this.momentum);
        this.v_b_h2.add(h2_gradients);
        this.b_h2.add(this.v_b_h2);

        // -------- Hidden Layer 1 --------
        // Backpropagate errors: E_h1 = W_h1h2^T · E_h2
        const w_h1h2_T = Matrix.transpose(this.w_h1h2);
        const h1_errors = Matrix.dot(w_h1h2_T, h2_errors);

        // Hidden1 gradients
        const h1_gradients = Matrix.map(h1, (y) => this.dsigmoid(y));
        h1_gradients.multiply(h1_errors);
        h1_gradients.multiply(this.learningRate);

        // Calculate W_ih1 deltas
        const inputs_T = Matrix.transpose(inputs);
        const w_ih1_deltas = Matrix.dot(h1_gradients, inputs_T);

        // Update W_ih1 with momentum
        this.v_w_ih1.multiply(this.momentum);
        this.v_w_ih1.add(w_ih1_deltas);
        this.w_ih1.add(this.v_w_ih1);
        
        // Update hidden1 bias
        this.v_b_h1.multiply(this.momentum);
        this.v_b_h1.add(h1_gradients);
        this.b_h1.add(this.v_b_h1);

        this.trainingCount++;
    }

    /**
     * Train on a batch of examples
     */
    trainBatch(examples: { features: number[]; target: number }[]): void {
        for (const example of examples) {
            this.trainSingle(example.features, example.target);
        }
        this.generation++;
        this.lastTrainedAt = new Date().toISOString();
    }

    /**
     * Train on a single example and increment generation
     * Main training method called from actions
     */
    async train(features: number[], target: number, domain: string = '', url: string = ''): Promise<void> {
        await this.load(); // Ensure we have latest weights
        
        this.trainSingle(features, target);
        this.generation++;
        this.lastTrainedAt = new Date().toISOString();
        
        // Save training example for future reference
        await this.saveTrainingExample(features, target, domain, url);
        
        // Save updated weights
        await this.save();
        
        logger.info(`[Carl] Trained on ${target === 1 ? 'POSITIVE' : 'NEGATIVE'} example. Gen: ${this.generation}`);
    }

    // ========================================================================
    // PERSISTENCE (Load/Save to Supabase)
    // ========================================================================

    /**
     * Load Carl's brain from database
     */
    async load(): Promise<void> {
        if (this.isInitialized) return;

        try {
            const supabase = await createClient();
            const { data, error } = await supabase
                .from('model_weights')
                .select('weights, generation, updated_at')
                .eq('id', CARL_CONFIG.modelId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data?.weights) {
                const state = data.weights as CarlModelState;
                
                // Restore weights
                this.w_ih1 = Matrix.deserialize(state.weights.w_ih1);
                this.w_h1h2 = Matrix.deserialize(state.weights.w_h1h2);
                this.w_h2o = Matrix.deserialize(state.weights.w_h2o);
                this.b_h1 = Matrix.deserialize(state.weights.b_h1);
                this.b_h2 = Matrix.deserialize(state.weights.b_h2);
                this.b_o = Matrix.deserialize(state.weights.b_o);
                
                // Restore metadata
                this.generation = state.generation || data.generation || 0;
                this.trainingCount = state.trainingCount || 0;
                this.accuracy = state.accuracy || 0;
                this.lastTrainedAt = state.lastTrainedAt || data.updated_at || '';
                
                logger.info(`[Carl] Loaded brain - Gen: ${this.generation}, Trained on: ${this.trainingCount} examples`);
            } else {
                logger.info('[Carl] No saved brain found, using fresh initialization');
                await this.save(); // Save initial state
            }
            
            this.isInitialized = true;
        } catch (error) {
            logger.error('[Carl] Failed to load brain', error);
            this.isInitialized = true; // Use random weights
        }
    }

    /**
     * Save Carl's brain to database
     */
    async save(): Promise<void> {
        try {
            const supabase = await createClient();
            
            const state: CarlModelState = {
                weights: {
                    w_ih1: this.w_ih1.serialize(),
                    w_h1h2: this.w_h1h2.serialize(),
                    w_h2o: this.w_h2o.serialize(),
                    b_h1: this.b_h1.serialize(),
                    b_h2: this.b_h2.serialize(),
                    b_o: this.b_o.serialize()
                },
                generation: this.generation,
                trainingCount: this.trainingCount,
                accuracy: this.accuracy,
                lastTrainedAt: this.lastTrainedAt,
                version: 'carl_v1'
            };

            await supabase
                .from('model_weights')
                .upsert({
                    id: CARL_CONFIG.modelId,
                    weights: state,
                    generation: this.generation,
                    updated_at: new Date().toISOString()
                });
                
            logger.info(`[Carl] Saved brain - Gen: ${this.generation}`);
        } catch (error) {
            logger.error('[Carl] Failed to save brain', error);
        }
    }

    /**
     * Save a training example for future retraining
     */
    private async saveTrainingExample(
        features: number[], 
        target: number, 
        domain: string, 
        url: string
    ): Promise<void> {
        try {
            const supabase = await createClient();
            
            await supabase
                .from('carl_training_data')
                .insert({
                    features,
                    target,
                    domain,
                    url,
                    model_version: CARL_CONFIG.modelId
                });
        } catch (error) {
            // Table might not exist yet, that's OK
            logger.warn('[Carl] Could not save training example', error);
        }
    }

    /**
     * Get all training examples for retraining
     */
    async getTrainingData(): Promise<TrainingExample[]> {
        try {
            const supabase = await createClient();
            const { data, error } = await supabase
                .from('carl_training_data')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(CARL_CONFIG.maxTrainingExamples);
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.warn('[Carl] Could not get training data', error);
            return [];
        }
    }

    /**
     * Retrain Carl on all stored training examples
     */
    async retrain(): Promise<{ generation: number; accuracy: number; examplesUsed: number }> {
        const examples = await this.getTrainingData();
        
        if (examples.length === 0) {
            logger.info('[Carl] No training data to retrain on');
            return { generation: this.generation, accuracy: 0, examplesUsed: 0 };
        }

        // Reset weights to fresh initialization
        this.initializeWeights();
        this.generation = 0;
        this.trainingCount = 0;

        // Train on all examples multiple epochs
        const epochs = 5;
        for (let epoch = 0; epoch < epochs; epoch++) {
            // Shuffle examples
            const shuffled = [...examples].sort(() => Math.random() - 0.5);
            
            for (const example of shuffled) {
                this.trainSingle(example.features, example.target);
            }
        }
        
        this.generation = epochs;
        this.lastTrainedAt = new Date().toISOString();

        // Calculate accuracy on training set
        let correct = 0;
        for (const example of examples) {
            const prediction = this.query(example.features);
            const predicted = prediction > 0.5 ? 1 : 0;
            if (predicted === example.target) correct++;
        }
        this.accuracy = correct / examples.length;

        await this.save();
        
        logger.info(`[Carl] Retrained on ${examples.length} examples. Accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
        
        return { generation: this.generation, accuracy: this.accuracy, examplesUsed: examples.length };
    }

    /**
     * Reset Carl to factory settings
     */
    async reset(): Promise<void> {
        this.initializeWeights();
        this.generation = 0;
        this.trainingCount = 0;
        this.accuracy = 0;
        this.lastTrainedAt = '';
        this.isInitialized = true;
        
        // Reset velocity matrices
        this.v_w_ih1 = new Matrix(CARL_CONFIG.hidden1Nodes, CARL_CONFIG.inputNodes);
        this.v_w_h1h2 = new Matrix(CARL_CONFIG.hidden2Nodes, CARL_CONFIG.hidden1Nodes);
        this.v_w_h2o = new Matrix(CARL_CONFIG.outputNodes, CARL_CONFIG.hidden2Nodes);
        this.v_b_h1 = new Matrix(CARL_CONFIG.hidden1Nodes, 1);
        this.v_b_h2 = new Matrix(CARL_CONFIG.hidden2Nodes, 1);
        this.v_b_o = new Matrix(CARL_CONFIG.outputNodes, 1);
        
        await this.save();
        logger.info('[Carl] Reset to factory settings');
    }

    // ========================================================================
    // STATS & DEBUGGING
    // ========================================================================

    /**
     * Get Carl's current stats
     */
    getStats() {
        return {
            generation: this.generation,
            trainingCount: this.trainingCount,
            accuracy: this.accuracy,
            lastTrainedAt: this.lastTrainedAt,
            architecture: `${CARL_CONFIG.inputNodes}-${CARL_CONFIG.hidden1Nodes}-${CARL_CONFIG.hidden2Nodes}-${CARL_CONFIG.outputNodes}`,
            learningRate: this.learningRate,
            momentum: this.momentum,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Get configuration
     */
    static getConfig() {
        return { ...CARL_CONFIG };
    }
}

// Export singleton creation helper
let carlInstance: Carl | null = null;

export async function getCarl(): Promise<Carl> {
    if (!carlInstance) {
        carlInstance = new Carl();
        await carlInstance.load();
    }
    return carlInstance;
}

// Export for testing
export { CARL_CONFIG };
