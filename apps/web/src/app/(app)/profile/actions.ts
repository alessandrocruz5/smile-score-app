"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { profileSchema, type ProfileInput } from "@/lib/validation";

export async function updateProfile(
  input: ProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid name" };
  try {
    await auth.api.updateUser({ headers: await headers(), body: { name: parsed.data.name } });
  } catch {
    return { ok: false, error: "Unable to save your name" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
