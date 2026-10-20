import type { User } from "firebase/auth";
export function accountVerified(
  user: Pick<User, "emailVerified" | "providerData"> | null,
) {
  return (
    !!user &&
    (user.emailVerified ||
      user.providerData?.some(
        (provider) => provider.providerId === "google.com",
      ))
  );
}
export function requireVerifiedAccount(
  user: Pick<User, "emailVerified" | "providerData"> | null,
) {
  if (!accountVerified(user))
    throw Error(
      "Verify your email before saving changes to your journal. Open Account & connections to resend the link or check verification.",
    );
}
