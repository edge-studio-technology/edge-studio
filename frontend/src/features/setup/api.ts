import { postJson } from "../../lib/api";
import type { AuthUser } from "../auth/types";

export async function completeSetup(input: { password: string }) {
  return postJson<{ success: boolean; user: AuthUser }>("/api/setup/complete", input);
}
