import { NeuralNetwork } from '../app/lib/learning/NeuralNetwork';

async function testXOR() {
    console.log('Initializing Neural Network for XOR test...');

    // 2 Inputs, 4 Hidden, 1 Output
    const nn = new NeuralNetwork(2, 4, 1);

    // XOR Training Data
    const training_data = [
        { inputs: [0, 0], target: 0 },
        { inputs: [0, 1], target: 1 },
        { inputs: [1, 0], target: 1 },
        { inputs: [1, 1], target: 0 }
    ];

    console.log('Training...');
    const epochs = 10000; // Train for 10,000 iterations

    for (let i = 0; i < epochs; i++) {
        const data = training_data[Math.floor(Math.random() * training_data.length)];
        // Mock the load/save methods to avoid DB calls during test
        nn.load = async () => { };
        nn.save = async () => { };

        await nn.train(data.inputs, data.target);

        if (i % 1000 === 0) {
            console.log(`Epoch ${i}: Training...`);
        }
    }

    console.log('\nTesting Predictions:');
    console.log('0, 0 ->', nn.predict([0, 0]).toFixed(4), '(Expected: 0)');
    console.log('0, 1 ->', nn.predict([0, 1]).toFixed(4), '(Expected: 1)');
    console.log('1, 0 ->', nn.predict([1, 0]).toFixed(4), '(Expected: 1)');
    console.log('1, 1 ->', nn.predict([1, 1]).toFixed(4), '(Expected: 0)');
}

testXOR().catch(console.error);
