'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Activity, Zap, CheckCircle, XCircle, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { getBrainStats, testBrainPrediction, trainBrain, retrainBrain, resetBrain } from '../actions';

// Carl's feature names for display
const CARL_FEATURE_NAMES = [
    'Privacy Keyword', 'Terms Keyword', 'Cookie Keyword', 'Legal Keyword', 'Text Match Strength',
    'URL Privacy Path', 'URL Terms Path', 'URL Legal Path', 'URL Depth', 'URL Length', 'HTTPS',
    'In Footer', 'In Nav', 'In Legal Hub', 'In Body',
    'Privacy Content', 'Policy Structure', 'Legal Jargon', 'Word Count', 'Contact Info',
    'Link Text Length', 'Has Icon', 'Is External', 'Has Year'
];

export default function BrainDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Test Lab State
    const [url, setUrl] = useState('/privacy-policy');
    const [linkText, setLinkText] = useState('Privacy Policy');
    const [context, setContext] = useState<'footer' | 'nav' | 'body' | 'legal_hub'>('footer');
    const [prediction, setPrediction] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Training State
    const [isTraining, setIsTraining] = useState(false);
    const [isRetraining, setIsRetraining] = useState(false);
    const [lastTrainingResult, setLastTrainingResult] = useState<string | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        const data = await getBrainStats();
        setStats(data);
        setLoading(false);
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setPrediction(null);
        setLastTrainingResult(null);

        try {
            const result = await testBrainPrediction(url, linkText, context);
            setPrediction(result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleTrain = async (target: number) => {
        if (!prediction) return;

        setIsTraining(true);
        try {
            const result = await trainBrain(prediction.features, target, 'brain-dashboard', url);
            setStats((prev: any) => ({ ...prev, generation: result.newGeneration }));
            setLastTrainingResult(target === 1 ? 'Reinforced as Positive' : 'Reinforced as Negative');

            // Re-run prediction to see change
            const newPred = await testBrainPrediction(url, linkText, context);
            setPrediction(newPred);
            await loadStats(); // Reload stats
        } catch (error) {
            console.error(error);
        } finally {
            setIsTraining(false);
        }
    };

    const handleRetrain = async () => {
        setIsRetraining(true);
        try {
            const result = await retrainBrain();
            if (result.success) {
                setLastTrainingResult(`Retrained on ${result.examplesUsed} examples! Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
                await loadStats();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsRetraining(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Are you sure you want to reset Carl? This will delete all learned weights.')) return;
        try {
            await resetBrain();
            setLastTrainingResult('Carl has been reset to initial state');
            await loadStats();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">



            <main className="container mx-auto px-4 pt-24 pb-12">

                {/* Header */}
                <div className="flex items-center gap-4 mb-12">
                    <div className="relative">
                        <motion.div
                            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 bg-purple-500 blur-xl rounded-full"
                        />
                        <Brain className="w-16 h-16 text-purple-400 relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                            Carl Dashboard
                        </h1>
                        <p className="text-gray-400">Live visualization of PolicyParser&apos;s Neural Network</p>
                    </div>
                </div>

                {/* Stats Grid - Now 4 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <Card>
                        <div className="flex items-center gap-3 mb-2">
                            <Activity className="w-5 h-5 text-blue-400" />
                            <h3 className="text-gray-400 font-medium">Generation</h3>
                        </div>
                        <div className="text-3xl font-bold text-white">
                            {loading ? '...' : stats?.generation}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Total training iterations</div>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-3 mb-2">
                            <Brain className="w-5 h-5 text-green-400" />
                            <h3 className="text-gray-400 font-medium">Architecture</h3>
                        </div>
                        <div className="text-3xl font-bold text-white">{loading ? '...' : stats?.architecture}</div>
                        <div className="text-xs text-gray-500 mt-1">Input → Hidden1 → Hidden2 → Output</div>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-3 mb-2">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            <h3 className="text-gray-400 font-medium">Learning Rate</h3>
                        </div>
                        <div className="text-3xl font-bold text-white">{loading ? '...' : stats?.learningRate}</div>
                        <div className="text-xs text-gray-500 mt-1">With momentum: {loading ? '...' : stats?.momentum}</div>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-3 mb-2">
                            <CheckCircle className="w-5 h-5 text-cyan-400" />
                            <h3 className="text-gray-400 font-medium">Training Data</h3>
                        </div>
                        <div className="text-3xl font-bold text-white">{loading ? '...' : stats?.trainingExamples}</div>
                        <div className="text-xs text-gray-500 mt-1">Stored training examples</div>
                    </Card>
                </div>

                {/* Admin Controls */}
                <div className="flex gap-4 mb-8">
                    <button
                        onClick={handleRetrain}
                        disabled={isRetraining}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 rounded-xl transition-all disabled:opacity-50"
                    >
                        <RotateCcw className={`w-4 h-4 ${isRetraining ? 'animate-spin' : ''}`} />
                        {isRetraining ? 'Retraining...' : 'Retrain on All Data'}
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        Reset Carl
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Test Lab */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-8 bg-purple-500 rounded-full" />
                            Test Lab
                        </h2>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Link Text</label>
                                    <input
                                        type="text"
                                        value={linkText}
                                        onChange={(e) => setLinkText(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">URL / Href</label>
                                    <input
                                        type="text"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Context</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['footer', 'nav', 'body', 'legal_hub'].map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setContext(c as any)}
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${context === c
                                                    ? 'bg-purple-500 text-white'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                    }`}
                                            >
                                                {c === 'legal_hub' ? 'Legal Hub' : c.charAt(0).toUpperCase() + c.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        'Analyze with Brain'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Results & Training */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-8 bg-pink-500 rounded-full" />
                            Prediction & Training
                        </h2>

                        {prediction ? (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm relative overflow-hidden">
                                {isTraining && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center">
                                        <div className="text-center">
                                            <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-2" />
                                            <p className="text-purple-300 font-bold">Learning...</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <div className="text-sm text-gray-400 mb-1">Confidence Score</div>
                                        <div className="text-5xl font-black text-white">
                                            {(prediction.score * 100).toFixed(1)}%
                                        </div>
                                        {prediction.rawScore !== undefined && prediction.rawScore !== prediction.score && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Raw: {(prediction.rawScore * 100).toFixed(1)}% (adjusted after analysis)
                                            </div>
                                        )}
                                    </div>
                                    <div className={`px-4 py-2 rounded-full font-bold ${prediction.score > 0.8 ? 'bg-green-500/20 text-green-400' :
                                        prediction.score > 0.5 ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                        }`}>
                                        {prediction.confidence || (prediction.score > 0.8 ? 'High' :
                                            prediction.score > 0.5 ? 'Medium' :
                                                'Low')}
                                    </div>
                                </div>

                                {/* Analysis Status */}
                                <div className="mb-6 p-3 bg-black/30 rounded-lg">
                                    <div className="flex items-center gap-2 text-sm">
                                        {prediction.pageAnalyzed ? (
                                            <span className="text-green-400">✓ Page analyzed</span>
                                        ) : (
                                            <span className="text-yellow-400">⚠ Page not analyzed</span>
                                        )}
                                        {prediction.contentLength > 0 && (
                                            <span className="text-gray-500">({(prediction.contentLength / 1000).toFixed(1)}KB)</span>
                                        )}
                                        {prediction.isHomepage && (
                                            <span className="text-orange-400 ml-2">📍 Homepage detected</span>
                                        )}
                                    </div>
                                    {prediction.analysisNote && (
                                        <div className="text-xs text-yellow-300 mt-2">{prediction.analysisNote}</div>
                                    )}
                                    {prediction.fetchError && (
                                        <div className="text-xs text-red-400 mt-2">Error: {prediction.fetchError}</div>
                                    )}
                                </div>

                                {/* Feature Breakdown - All 24 Carl Features */}
                                <div className="mb-8">
                                    <h4 className="text-sm font-bold text-gray-300 mb-3">Features (24 total)</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2">
                                        {CARL_FEATURE_NAMES.map((label, i) => (
                                            <div key={i} className="flex justify-between text-xs p-2 bg-black/30 rounded">
                                                <span className="text-gray-400 truncate mr-2">{label}</span>
                                                <span className={`font-mono ${prediction.features[i] > 0.5 ? 'text-green-400' : 'text-purple-300'}`}>
                                                    {prediction.features[i]?.toFixed(2) || '0.00'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Training Controls */}
                                <div className="border-t border-white/10 pt-6">
                                    <h4 className="text-sm font-bold text-gray-300 mb-3 text-center">
                                        Is this a Privacy Policy?
                                    </h4>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleTrain(0)}
                                            className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="w-5 h-5" />
                                            No (Train 0)
                                        </button>
                                        <button
                                            onClick={() => handleTrain(1)}
                                            className="flex-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/50 text-green-400 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            Yes (Train 1)
                                        </button>
                                    </div>
                                    {lastTrainingResult && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-center text-sm text-purple-300 mt-4"
                                        >
                                            ✨ {lastTrainingResult}
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-64 border-2 border-dashed border-white/10 rounded-2xl flex items-center justify-center text-gray-500">
                                Run an analysis to see the brain in action
                            </div>
                        )}
                    </div>
                </div>

            </main>

        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm hover:bg-white/10 transition-colors">
            {children}
        </div>
    );
}
