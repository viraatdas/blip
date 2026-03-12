import Stripe from "stripe";
import type { UserRecord } from "../../common/types.js";
import { HttpError } from "../../common/errors.js";
import type { UserRepository } from "../repositories/interfaces.js";

export class BillingService {
  private readonly stripe: Stripe;
  private readonly userRepository: UserRepository;
  private readonly webhookSecret: string;

  public constructor(stripeSecretKey: string, webhookSecret: string, userRepository: UserRepository) {
    this.stripe = new Stripe(stripeSecretKey);
    this.webhookSecret = webhookSecret;
    this.userRepository = userRepository;
  }

  public async createSetupSession(
    userId: string,
    email: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ checkout_url: string }> {
    let user = await this.userRepository.getById(userId);

    let customerId: string;
    if (user?.stripeCustomerId) {
      customerId = user.stripeCustomerId;
    } else {
      const customer = await this.stripe.customers.create({
        email,
        metadata: { userId }
      });
      customerId = customer.id;

      if (!user) {
        user = {
          userId,
          email,
          stripeCustomerId: customerId,
          hasPaymentMethod: false,
          createdAt: new Date().toISOString()
        };
        await this.userRepository.create(user);
      } else {
        user.stripeCustomerId = customerId;
        await this.userRepository.save(user);
      }
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: "setup",
      currency: "usd",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId }
    });

    if (!session.url) {
      throw new HttpError(502, "stripe_error", "Stripe did not return a checkout URL.");
    }

    return { checkout_url: session.url };
  }

  public async createPortalSession(userId: string, returnUrl: string): Promise<{ portal_url: string }> {
    const user = await this.userRepository.getById(userId);
    if (!user?.stripeCustomerId) {
      throw new HttpError(404, "no_customer", "No billing account found. Add a payment method first.");
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl
    });

    return { portal_url: session.url };
  }

  public async getStatus(userId: string): Promise<{
    has_payment_method: boolean;
    email: string | null;
  }> {
    const user = await this.userRepository.getById(userId);
    if (!user) {
      return { has_payment_method: false, email: null };
    }

    return {
      has_payment_method: user.hasPaymentMethod,
      email: user.email
    };
  }

  public async handleWebhook(rawBody: string, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch {
      throw new HttpError(400, "invalid_signature", "Webhook signature verification failed.");
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) break;

        let user = await this.userRepository.getById(userId);
        if (!user) {
          user = {
            userId,
            email: session.customer_email ?? session.customer_details?.email ?? "",
            stripeCustomerId: session.customer as string,
            hasPaymentMethod: true,
            createdAt: new Date().toISOString()
          };
          await this.userRepository.create(user);
        } else {
          user.hasPaymentMethod = true;
          if (!user.stripeCustomerId) {
            user.stripeCustomerId = session.customer as string;
          }
          await this.userRepository.save(user);
        }
        break;
      }
    }
  }
}
