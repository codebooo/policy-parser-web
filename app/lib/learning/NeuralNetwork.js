"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralNetwork = void 0;
const server_1 = require("@/utils/supabase/server");
const logger_1 = require("../logger");
const FeatureExtractor_1 = require("./FeatureExtractor");
const Matrix_1 = require("./Matrix");
const HIDDEN_NODES = 16; // Increased complexity for "brain"
const OUTPUT_NODES = 1;
const LEARNING_RATE = 0.1;
class NeuralNetwork {
    constructor(input_nodes = FeatureExtractor_1.FEATURE_COUNT, hidden_nodes = HIDDEN_NODES, output_nodes = OUTPUT_NODES) {
        this.isInitialized = false;
        // Helper for dsigmoid mapping
        this.dsmoid = (y) => y * (1 - y);
        this.input_nodes = input_nodes;
        this.hidden_nodes = hidden_nodes;
        this.output_nodes = output_nodes;
        this.learning_rate = LEARNING_RATE;
        this.generation = 0;
        // Initialize weights
        this.weights_ih = new Matrix_1.Matrix(this.hidden_nodes, this.input_nodes);
        this.weights_ho = new Matrix_1.Matrix(this.output_nodes, this.hidden_nodes);
        this.weights_ih.randomize();
        this.weights_ho.randomize();
        // Initialize biases
        this.bias_h = new Matrix_1.Matrix(this.hidden_nodes, 1);
        this.bias_o = new Matrix_1.Matrix(this.output_nodes, 1);
        this.bias_h.randomize();
        this.bias_o.randomize();
    }
    /**
     * Load weights from database or cache
     */
    async load() {
        if (this.isInitialized)
            return;
        try {
            const supabase = await (0, server_1.createClient)();
            const { data, error } = await supabase
                .from('model_weights')
                .select('weights, generation')
                .eq('id', 'active_model')
                .single();
            if (data && data.weights) {
                const w = data.weights;
                // Reconstruct Matrices from JSON data
                this.weights_ih = new Matrix_1.Matrix(w.weights_ih.length, w.weights_ih[0].length);
                this.weights_ih.data = w.weights_ih;
                this.weights_ho = new Matrix_1.Matrix(w.weights_ho.length, w.weights_ho[0].length);
                this.weights_ho.data = w.weights_ho;
                this.bias_h = new Matrix_1.Matrix(w.bias_h.length, w.bias_h[0].length);
                this.bias_h.data = w.bias_h;
                this.bias_o = new Matrix_1.Matrix(w.bias_o.length, w.bias_o[0].length);
                this.bias_o.data = w.bias_o;
                this.generation = data.generation;
                this.isInitialized = true;
                logger_1.logger.info(`[NeuralNetwork] Loaded generation ${this.generation}`);
            }
            else {
                logger_1.logger.info('[NeuralNetwork] No saved model found, using random weights');
                await this.save(); // Save initial random weights
                this.isInitialized = true;
            }
        }
        catch (error) {
            logger_1.logger.error('[NeuralNetwork] Failed to load weights', error);
            this.isInitialized = true; // Fallback to random
        }
    }
    /**
     * Save current weights to database
     */
    async save() {
        try {
            const supabase = await (0, server_1.createClient)();
            const weightsData = {
                weights_ih: this.weights_ih.data,
                weights_ho: this.weights_ho.data,
                bias_h: this.bias_h.data,
                bias_o: this.bias_o.data,
                generation: this.generation
            };
            await supabase
                .from('model_weights')
                .upsert({
                id: 'active_model',
                weights: weightsData,
                generation: this.generation,
                updated_at: new Date().toISOString()
            });
            logger_1.logger.info(`[NeuralNetwork] Saved generation ${this.generation}`);
        }
        catch (error) {
            logger_1.logger.error('[NeuralNetwork] Failed to save weights', error);
        }
    }
    /**
     * Sigmoid activation function
     */
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }
    /**
     * Derivative of sigmoid (y = sigmoid(x))
     * dsigmoid = y * (1 - y)
     */
    dsigmoid(y) {
        return y * (1 - y);
    }
    /**
     * Forward pass: Predict score (0-1) for features
     * Alias for 'query' in the book
     */
    predict(input_array) {
        if (input_array.length !== this.input_nodes) {
            throw new Error(`Expected ${this.input_nodes} features, got ${input_array.length}`);
        }
        // Generating the Hidden Outputs
        const inputs = Matrix_1.Matrix.fromArray(input_array);
        const hidden = Matrix_1.Matrix.multiply(this.weights_ih, inputs);
        hidden.add(this.bias_h);
        // Activation function!
        hidden.map(this.sigmoid);
        // Generating the output's output!
        const output = Matrix_1.Matrix.multiply(this.weights_ho, hidden);
        output.add(this.bias_o);
        output.map(this.sigmoid);
        // Return the single output value
        return output.data[0][0];
    }
    /**
     * Train the network (Backpropagation)
     * @param input_array Feature vector
     * @param target_val Target value (1 for correct, 0 for incorrect)
     */
    async train(input_array, target_val) {
        await this.load(); // Ensure we have latest weights
        // 1. Forward Pass
        const inputs = Matrix_1.Matrix.fromArray(input_array);
        // Hidden
        const hidden = Matrix_1.Matrix.multiply(this.weights_ih, inputs);
        hidden.add(this.bias_h);
        hidden.map(this.sigmoid);
        // Output
        const outputs = Matrix_1.Matrix.multiply(this.weights_ho, hidden);
        outputs.add(this.bias_o);
        outputs.map(this.sigmoid);
        // 2. Calculate Errors
        // Convert target to Matrix
        const targets = Matrix_1.Matrix.fromArray([target_val]);
        // Calculate the error
        // ERROR = TARGETS - OUTPUTS
        const output_errors = Matrix_1.Matrix.subtract(targets, outputs);
        // Calculate gradient
        const gradients = Matrix_1.Matrix.map(outputs, this.dsmoid);
        gradients.multiply(output_errors);
        gradients.multiply(this.learning_rate);
        // Calculate deltas
        const hidden_T = Matrix_1.Matrix.transpose(hidden);
        const weight_ho_deltas = Matrix_1.Matrix.multiply(gradients, hidden_T);
        // Adjust the weights by deltas
        this.weights_ho.add(weight_ho_deltas);
        // Adjust the bias by its deltas (which is just the gradients)
        this.bias_o.add(gradients);
        // 3. Calculate Hidden Errors
        const who_t = Matrix_1.Matrix.transpose(this.weights_ho);
        const hidden_errors = Matrix_1.Matrix.multiply(who_t, output_errors);
        // Calculate hidden gradient
        const hidden_gradient = Matrix_1.Matrix.map(hidden, this.dsmoid);
        hidden_gradient.multiply(hidden_errors);
        hidden_gradient.multiply(this.learning_rate);
        // Calculate input->hidden deltas
        const inputs_T = Matrix_1.Matrix.transpose(inputs);
        const weight_ih_deltas = Matrix_1.Matrix.multiply(hidden_gradient, inputs_T);
        // Adjust the weights by deltas
        this.weights_ih.add(weight_ih_deltas);
        // Adjust the bias by its deltas
        this.bias_h.add(hidden_gradient);
        this.generation++;
        // Only save periodically or if error was significant (optimization)
        // For now, save every time to ensure persistence
        await this.save();
        logger_1.logger.info(`[NeuralNetwork] Trained on target ${target_val}. New Gen: ${this.generation}`);
    }
}
exports.NeuralNetwork = NeuralNetwork;
