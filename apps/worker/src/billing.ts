import Stripe from "stripe";
import { getSupabaseClient } from "@blip/db";

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY must be set");
    stripe = new Stripe(key);
  }
  return stripe;
}

export async function reportUsage(
  userId: string,
  executionId: string,
  resultData: Record<string, unknown>,
): Promise<void> {
  try {
    // Look up the user's Stripe customer ID
    const client = getSupabaseClient();
    const { data: user } = await client
      .from("users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!user?.stripe_customer_id) {
      console.warn(`[billing] No Stripe customer for user ${userId}, skipping usage report`);
      return;
    }

    const s = getStripe();
    await s.billing.meterEvents.create({
      event_name: "blip_execution",
      payload: {
        stripe_customer_id: user.stripe_customer_id,
        value: String(Math.ceil((resultData.cost_usd as number) ?? 0 * 100)),
      },
    });

    console.log(`[billing] Reported usage for execution ${executionId}`);
  } catch (err) {
    console.error(`[billing] Failed to report usage:`, err);
    // Don't throw - billing failures shouldn't break execution processing
  }
}
