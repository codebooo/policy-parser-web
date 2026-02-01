import { NextResponse } from "next/server";
import Stripe from "stripe";

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
    if (!stripeInstance) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
            apiVersion: "2025-01-27.acacia" as any,
        });
    }
    return stripeInstance;
}

export async function POST(req: Request) {
    try {
        const { amount, paymentMethod } = await req.json();

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: "Stripe API key is missing. Please set STRIPE_SECRET_KEY." },
                { status: 500 }
            );
        }
        
        const stripe = getStripe();

        // Configure payment method types based on the selected method
        let paymentMethodTypes: string[] = ['card'];
        
        if (paymentMethod === 'paypal') {
            paymentMethodTypes = ['paypal'];
        } else if (paymentMethod === 'klarna') {
            paymentMethodTypes = ['klarna'];
        } else {
            // Default: card
            paymentMethodTypes = ['card'];
        }

        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
            amount: amount,
            currency: "eur",
            payment_method_types: paymentMethodTypes as any,
        };

        // Klarna requires additional shipping/billing info for some regions
        if (paymentMethod === 'klarna') {
            paymentIntentParams.payment_method_options = {
                klarna: {
                    preferred_locale: 'en-US',
                }
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

        return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
        console.error("Internal Error:", error);
        return NextResponse.json(
            { error: `Internal Server Error: ${error.message}` },
            { status: 500 }
        );
    }
}
