import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import * as userRepo from "@blip/db/repositories/user-repository";
import type { UserRecord } from "@blip/shared";

/**
 * Get the current user from the database, creating them if they don't exist yet.
 * This handles the case where a user signs up via Clerk but the webhook
 * hasn't fired or isn't configured.
 */
export async function getUser(): Promise<UserRecord> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  let user = await userRepo.findByClerkId(clerkUserId);
  if (!user) {
    // Just-in-time provisioning: create user in DB from Clerk data
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "unknown";
    user = await userRepo.create({
      clerk_user_id: clerkUserId,
      email,
    });
  }

  return user;
}
