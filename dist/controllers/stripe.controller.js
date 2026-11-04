"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeController = exports.StripeController = void 0;
const stripe_service_1 = require("../services/stripe.service");
class StripeController {
    /**
     * GET /api/checkout/plans
     * Return available tiers (Starter, Creator, Pro)
     */
    async getPlans(_req, res) {
        return res.status(200).json({
            plans: Object.values(stripe_service_1.PRICING_PLANS),
        });
    }
    /**
     * POST /api/checkout
     * Generate Stripe Checkout Session for subscription plans
     */
    async createCheckout(req, res) {
        try {
            const { planId, billingCycle = 'monthly', userId = 'user_demo_1', userEmail = 'creator@example.com' } = req.body;
            if (!planId || !['starter', 'creator', 'pro'].includes(planId)) {
                return res.status(400).json({
                    error: 'Invalid planId. Must be one of: starter, creator, pro.',
                });
            }
            if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
                return res.status(400).json({
                    error: 'Invalid billingCycle. Must be either monthly or yearly.',
                });
            }
            const session = await stripe_service_1.stripeService.createCheckoutSession({
                planId,
                billingCycle,
                userId,
                customerEmail: userEmail,
            });
            return res.status(200).json({
                success: true,
                sessionId: session.sessionId,
                url: session.url,
            });
        }
        catch (error) {
            console.error('❌ [StripeController] Error creating checkout session:', error);
            return res.status(500).json({
                error: 'Failed to create checkout session',
                details: error?.message || 'Internal server error',
            });
        }
    }
    /**
     * POST /api/webhooks/stripe
     * Handles Stripe webhooks with raw body signature verification
     */
    async handleWebhook(req, res) {
        const sig = req.headers['stripe-signature'];
        if (!sig) {
            console.error('❌ [StripeController Webhook] Missing stripe-signature header');
            return res.status(400).json({ error: 'Missing stripe-signature header' });
        }
        try {
            // req.body here must be the raw Buffer or string from express.raw middleware
            const rawBody = req.body;
            const event = stripe_service_1.stripeService.constructWebhookEvent(rawBody, sig);
            await stripe_service_1.stripeService.handleWebhookEvent(event);
            return res.status(200).json({ received: true, type: event.type });
        }
        catch (error) {
            console.error('❌ [StripeController Webhook] Error processing webhook:', error);
            return res.status(400).json({
                error: 'Webhook verification or processing failed',
                details: error?.message,
            });
        }
    }
}
exports.StripeController = StripeController;
exports.stripeController = new StripeController();
