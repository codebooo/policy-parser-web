"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, X } from "lucide-react";
import { upgradeToPro } from "@/app/paymentActions";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

function CheckoutForm({ onSuccess, paymentMethod }: { onSuccess: () => void; paymentMethod: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsLoading(true);
        setMessage(null);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.origin + "/account?payment=success",
            },
            redirect: "if_required",
        });

        if (error) {
            setMessage(error.message || "An unexpected error occurred.");
            setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
            setMessage("Payment successful!");
            await onSuccess();
        } else if (paymentIntent && paymentIntent.status === "requires_action") {
            // Handle 3D Secure or other actions
            setMessage("Additional verification required...");
        } else {
            setMessage("Payment processing...");
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement 
                options={{
                    layout: 'tabs',
                }}
            />
            {message && (
                <div className={clsx(
                    "text-sm p-3 rounded-lg",
                    message.includes("successful") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                )}>
                    {message}
                </div>
            )}
            <Button 
                disabled={isLoading || !stripe || !elements} 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        Pay €0.99
                    </>
                )}
            </Button>
        </form>
    );
}

export function PaymentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [clientSecret, setClientSecret] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "klarna" | "crypto">("card");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (isOpen && paymentMethod !== "crypto") {
            setClientSecret("");
            setError(null);
            
            // Create PaymentIntent with the selected payment method
            fetch("/api/create-payment-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    amount: 99, // €0.99 in cents
                    paymentMethod: paymentMethod 
                }),
            })
                .then((res) => res.json())
                .then((data) => {
                    if (data.error) {
                        setError(data.error);
                    } else {
                        setClientSecret(data.clientSecret);
                    }
                })
                .catch((err) => {
                    console.error("Failed to init payment", err);
                    setError("Failed to initialize payment. Please try again.");
                });
        }
    }, [isOpen, paymentMethod]);

    const handleSuccess = async () => {
        setIsProcessing(true);
        const result = await upgradeToPro();
        if (result.success) {
            router.push("/account?upgraded=true");
            onClose();
        } else {
            setError("Payment successful, but upgrade failed. Please contact support.");
        }
        setIsProcessing(false);
    };

    const handleCryptoPayment = async () => {
        setIsProcessing(true);
        // Simulate crypto verification - in production, verify on-chain
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await handleSuccess();
    };

    if (!isOpen) return null;

    const paymentMethods = [
        { id: "card" as const, label: "Card", icon: "💳" },
        { id: "paypal" as const, label: "PayPal", icon: "🅿️" },
        { id: "klarna" as const, label: "Klarna", icon: "🛒" },
        { id: "crypto" as const, label: "Crypto", icon: "₿" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg p-6 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Upgrade to Pro</h2>
                        <p className="text-sm text-muted-foreground">€0.99/month • Cancel anytime</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Pro Features */}
                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-amber-400/10 to-orange-500/10 border border-amber-400/20">
                    <p className="text-sm font-medium text-amber-400 mb-2">Pro includes:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                        <li>✓ Analyze ALL policies (Privacy, Terms, Cookies, etc.)</li>
                        <li>✓ Policy change tracking & notifications</li>
                        <li>✓ Unlimited analyses per month</li>
                        <li>✓ Priority support</li>
                    </ul>
                </div>

                {/* Payment Method Tabs */}
                <div className="grid grid-cols-4 gap-2 p-1 bg-black/40 rounded-lg mb-6 border border-white/5">
                    {paymentMethods.map((method) => (
                        <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id)}
                            className={clsx(
                                "flex flex-col items-center justify-center py-3 text-xs font-medium rounded-md transition-all gap-1",
                                paymentMethod === method.id
                                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                                    : "text-muted-foreground hover:text-white hover:bg-white/5"
                            )}
                        >
                            <span className="text-lg">{method.icon}</span>
                            <span>{method.label}</span>
                        </button>
                    ))}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Content */}
                <div className="min-h-[280px]">
                    {paymentMethod !== "crypto" ? (
                        clientSecret ? (
                            <Elements 
                                stripe={stripePromise} 
                                options={{
                                    clientSecret,
                                    appearance: { 
                                        theme: 'night', 
                                        variables: { 
                                            colorPrimary: '#06b6d4',
                                            colorBackground: '#0f172a',
                                            colorText: '#ffffff',
                                            colorDanger: '#ef4444',
                                            fontFamily: 'system-ui, sans-serif',
                                            borderRadius: '8px',
                                        },
                                        rules: {
                                            '.Input': {
                                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                            },
                                            '.Input:focus': {
                                                border: '1px solid #06b6d4',
                                                boxShadow: '0 0 0 1px #06b6d4',
                                            },
                                        }
                                    },
                                }}
                            >
                                <CheckoutForm onSuccess={handleSuccess} paymentMethod={paymentMethod} />
                            </Elements>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">Initializing secure payment...</p>
                            </div>
                        )
                    ) : (
                        <div className="space-y-6 text-center py-4 animate-in fade-in slide-in-from-right-4">
                            <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                                <p className="text-sm text-muted-foreground mb-3">Send €0.99 equivalent to:</p>
                                <code className="block p-3 bg-black/50 rounded-lg text-xs break-all font-mono text-primary border border-primary/20 select-all cursor-pointer hover:bg-black/70 transition-colors">
                                    0x71C7656EC7ab88b098defB751B7401B5f6d8976F
                                </code>
                                <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> ETH</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> USDC</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> USDT</span>
                                </div>
                            </div>
                            <Button 
                                onClick={handleCryptoPayment} 
                                disabled={isProcessing} 
                                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-lg"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    "I have sent the funds"
                                )}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Security Notice */}
                <div className="mt-4 pt-4 border-t border-white/5 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                        <span>🔒</span> Secured by Stripe • 256-bit SSL encryption
                    </p>
                </div>

            </div>
        </div>
    );
}
