"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeService = exports.StripeService = exports.PRICING_PLANS = void 0;
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const prisma_1 = __importDefault(require("../prisma"));
exports.PRICING_PLANS = {
    starter: {
        id: 'starter',
        name: 'Starter',
        monthlyPriceEur: 19,
        yearlyPriceEur: 15,
        maxClipsPerProject: 10,
        exportResolution: '1080p Full HD',
        features: ['30 videos/mo', '10 clips/batch', 'Silence removal', 'DE & EN Subtitles'],
    },
    creator: {
        id: 'creator',
        name: 'Creator',
        monthlyPriceEur: 49,
        yearlyPriceEur: 39,
        maxClipsPerProject: 25,
        exportResolution: '4K Ultra HD',
        features: ['Unlimited exports', '25+ clips/batch', 'AI B-Roll', 'Priority Queue', 'Team 3 seats'],
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        monthlyPriceEur: 99,
        yearlyPriceEur: 79,
        maxClipsPerProject: 50,
        exportResolution: '4K ProRes / Custom',
        features: ['Unlimited batch 50+ clips', 'Dedicated GPU', 'Full API & Webhooks', '24/7 Slack support'],
    },
};
class StripeService {
    stripe;
    hasLiveSecret;
    constructor() {
        this.hasLiveSecret = Boolean(env_1.ENV.STRIPE_SECRET_KEY &&
            env_1.ENV.STRIPE_SECRET_KEY.startsWith('sk_') &&
            !env_1.ENV.STRIPE_SECRET_KEY.includes('mock'));
        this.stripe = new stripe_1.default(env_1.ENV.STRIPE_SECRET_KEY, {
            apiVersion: '2025-02-24.acacia',
        });
    }
    /**
     * Generates a Stripe Checkout Session for subscription tiers
     */
    async createCheckoutSession(params) {
        const plan = exports.PRICING_PLANS[params.planId];
        if (!plan) {
            throw new Error(`Invalid plan: ${params.planId}`);
        }
        const appUrl = env_1.ENV.FRONTEND_URL;
        const lang = params.locale || 'de';
        const successUrl = `${appUrl}/${lang}/dashboard?checkout_status=success&session_id={CHECKOUT_SESSION_ID}&plan=${params.planId}`;
        const cancelUrl = `${appUrl}/${lang}/pricing?checkout_status=cancelled`;
        if (this.hasLiveSecret) {
            const isYearly = params.billingCycle === 'yearly';
            const session = await this.stripe.checkout.sessions.create({
                mode: 'subscription',
                line_items: [
                    {
                        price_data: {
                            currency: 'eur',
                            product_data: {
                                name: `ClipViral AI ${plan.name} (${isYearly ? 'Jährlich' : 'Monatlich'})`,
                                description: `AI Video Editor Plan - ${plan.exportResolution}, max ${plan.maxClipsPerProject} clips/batch.`,
                            },
                            unit_amount: isYearly ? plan.yearlyPriceEur * 12 * 100 : plan.monthlyPriceEur * 100,
                            recurring: {
                                interval: isYearly ? 'year' : 'month',
                            },
                        },
                        quantity: 1,
                    },
                ],
                customer_email: params.customerEmail,
                client_reference_id: params.userId,
                metadata: {
                    userId: params.userId || 'anonymous_creator',
                    planId: params.planId,
                    billingCycle: params.billingCycle,
                },
                subscription_data: {
                    metadata: {
                        userId: params.userId || 'anonymous_creator',
                        planId: params.planId,
                        billingCycle: params.billingCycle,
                    },
                },
                success_url: successUrl,
                cancel_url: cancelUrl,
            });
            return {
                sessionId: session.id,
                url: session.url || successUrl,
            };
        }
        // Mock dev checkout session
        const mockSessionId = `cs_test_${Date.now()}_${params.planId}`;
        return {
            sessionId: mockSessionId,
            url: `${appUrl}/${lang}/dashboard?checkout_status=mock_success&plan=${params.planId}&session_id=${mockSessionId}`,
        };
    }
    /**
     * Verifies and constructs Stripe Webhook Event
     */
    constructWebhookEvent(payload, signature) {
        if (this.hasLiveSecret && env_1.ENV.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
            return this.stripe.webhooks.constructEvent(payload, signature, env_1.ENV.STRIPE_WEBHOOK_SECRET);
        }
        // Parse JSON fallback for testing
        try {
            const str = typeof payload === 'string' ? payload : payload.toString('utf8');
            return JSON.parse(str);
        }
        catch {
            return {
                id: `evt_mock_${Date.now()}`,
                object: 'event',
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_test_mock',
                        customer: 'cus_mock_123',
                        subscription: 'sub_mock_123',
                        metadata: {
                            userId: 'user-creator-01',
                            planId: 'creator',
                            billingCycle: 'yearly',
                        },
                    },
                },
            };
        }
    }
    /**
     * Processes verified Stripe Webhook event and syncs Prisma Subscription model
     */
    async handleWebhookEvent(event) {
        console.log(`[StripeService] Processing Webhook: ${event.type}`);
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
                const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
                const metadata = session.metadata || {};
                const planTier = metadata.planId || 'creator';
                const billingCycle = metadata.billingCycle || 'monthly';
                let targetUserId = metadata.userId && metadata.userId !== 'anonymous_creator' ? metadata.userId : null;
                if (!targetUserId) {
                    const email = session.customer_email || session.customer_details?.email;
                    if (email) {
                        const user = await prisma_1.default.user.findUnique({ where: { email } });
                        targetUserId = user ? user.id : null;
                    }
                }
                if (targetUserId && stripeSubscriptionId) {
                    const finalUserId = targetUserId;
                    await prisma_1.default.subscription.upsert({
                        where: { stripeSubscriptionId },
                        update: {
                            status: 'active',
                            tier: planTier,
                            billingCycle,
                            stripeCustomerId,
                            cancelAtPeriodEnd: false,
                        },
                        create: {
                            userId: finalUserId,
                            stripeCustomerId,
                            stripeSubscriptionId,
                            tier: planTier,
                            status: 'active',
                            billingCycle,
                            cancelAtPeriodEnd: false,
                        },
                    });
                    console.log(`[StripeService] User ${finalUserId} subscription updated to ${planTier}.`);
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const stripeSubscriptionId = subscription.id;
                const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : null;
                const metadata = subscription.metadata || {};
                const updatedTier = metadata.planId || undefined;
                const billingCycle = metadata.billingCycle || undefined;
                await prisma_1.default.subscription.updateMany({
                    where: { stripeSubscriptionId },
                    data: {
                        status: subscription.status,
                        cancelAtPeriodEnd: subscription.cancel_at_period_end,
                        stripeCustomerId,
                        ...(updatedTier ? { tier: updatedTier } : {}),
                        ...(billingCycle ? { billingCycle } : {}),
                    },
                });
                console.log(`[StripeService] Subscription ${stripeSubscriptionId} status updated to ${subscription.status}`);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await prisma_1.default.subscription.updateMany({
                    where: { stripeSubscriptionId: subscription.id },
                    data: {
                        status: 'canceled',
                        tier: 'starter',
                        cancelAtPeriodEnd: false,
                    },
                });
                console.log(`[StripeService] Subscription ${subscription.id} deleted. Reverted to starter tier.`);
                break;
            }
        }
    }
}
exports.StripeService = StripeService;
exports.stripeService = new StripeService();
