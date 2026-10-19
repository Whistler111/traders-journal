export function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  // Log only a diagnostic code in development, never credentials or the full error.
  if (
    import.meta.env.DEV &&
    typeof code === "string" &&
    /^auth\/[a-z-]+$/.test(code)
  )
    console.warn(`[Trade Notes sign-in] ${code}`);
  switch (code) {
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "Firebase rejected this site's API key. Check the web-app configuration in .env.local, restart the dev server and reload the page.";
    case "auth/configuration-not-found":
    case "auth/admin-restricted-operation":
      return "Firebase Authentication is not configured for this project. Open Firebase Console, get started with Authentication, and enable your sign-in providers.";
    case "auth/app-not-authorized":
    case "auth/invalid-app-credential":
      return "Firebase rejected this app's configuration. Check that the API key and auth domain belong to the same Firebase web app and that the key allows Firebase Authentication.";
    case "auth/invalid-oauth-client-id":
    case "auth/invalid-oauth-provider":
    case "auth/unauthorized-client":
      return "Google sign-in needs its OAuth configuration checked in Firebase Console. Enable Google and check the web client and redirect domain.";
    case "auth/operation-not-supported-in-this-environment":
    case "auth/web-storage-unsupported":
      return "This browser is blocking sign-in storage. Try a regular browser window with site storage allowed.";
    case "auth/internal-error":
      return "Google sign-in could not finish. Check Firebase's Google provider and auth-domain settings, then reload and try again.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect. Please try again.";
    case "auth/email-already-in-use":
      return "This email already has an account. Sign in or reset your password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "Choose a stronger password that meets your account's password requirements.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google window was closed. You can try again or use email.";
    case "auth/network-request-failed":
      return "We couldn't connect. Check your internet connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a little before trying again.";
    case "auth/user-disabled":
      return "This account is disabled. Contact your account administrator.";
    case "auth/account-exists-with-different-credential":
      return "This email uses another sign-in method. Sign in using your original method.";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled yet. Enable it in Firebase Authentication.";
    case "auth/unauthorized-domain":
      return "This site's domain needs to be authorized in Firebase Authentication.";
    default:
      return code
        ? "We couldn't complete sign-in. Please try again."
        : error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
  }
}
export function dataMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "permission-denied")
    return "Your account cannot access this journal. Check the published Firestore rules.";
  if (code === "unavailable" || code === "deadline-exceeded")
    return "Cloud storage is unavailable. Check your connection and try again; your changes have not been confirmed.";
  if (code === "resource-exhausted")
    return "Cloud storage has reached its quota. Please try again later.";
  if (code === "unauthenticated") return "Please sign in again before saving.";
  return code
    ? "Cloud storage could not complete this operation. Please try again."
    : error instanceof Error
      ? error.message
      : "Cloud storage is unavailable.";
}
