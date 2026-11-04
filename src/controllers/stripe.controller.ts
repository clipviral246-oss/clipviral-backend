import { Request, Response } from 'express';
import { stripeService, PRICING_PLANS } from '../services/stripe.service';

export class StripeController {
  /**
   * GET /api/checkout/plans
   * Return available tiers (Starter, Creator, Pro)
   */
  async getPlans(_req: Request, res: Response) {
    return res.status(200).json({
      plans: Object.values(PRICING_PLANS),
    });
  }

  /**
   * POST /api/checkout
   * Generate Stripe Checkout Session for subscription plans
   */
  async createCheckout(req: Request, res: Response) {
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

      const session = await stripeService.createCheckoutSession({
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
    } catch (error: any) {
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
  async handleWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      console.error('❌ [StripeController Webhook] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    try {
      // req.body here must be the raw Buffer or string from express.raw middleware
      const rawBody = req.body;
      const event = stripeService.constructWebhookEvent(rawBody, sig);
      await stripeService.handleWebhookEvent(event);

      return res.status(200).json({ received: true, type: event.type });
    } catch (error: any) {
      console.error('❌ [StripeController Webhook] Error processing webhook:', error);
      return res.status(400).json({
        error: 'Webhook verification or processing failed',
        details: error?.message,
      });
    }
  }
}

export const stripeController = new StripeController();
