import { cookies } from "next/headers";
import { verifyUserSession } from "@/lib/server/auth";

export async function getCurrentUserId() {
  const cookieStore = await cookies();
  const session = cookieStore.get("user_session")?.value;
  const verifiedSession = verifyUserSession(session);

  if (verifiedSession?.sub) {
    return verifiedSession.sub;
  }

  console.warn(
    `AmtBrief: no valid user_session cookie (cookiePresent=${Boolean(session)}), falling back to test/dev user`,
  );

  return process.env.MPOWER_TEST_USER_ID ?? "dev-user";
}
