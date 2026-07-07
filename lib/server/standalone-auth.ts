// Standalone mode = the app runs as an independent mobile app (Capacitor),
// not as a SuperApp MiniApp. In this mode we use our own login screen and a
// signed `user_session` cookie instead of the SuperApp's Silent SSO.
//
// Enabled via STANDALONE_AUTH=1 (or NEXT_PUBLIC_STANDALONE_AUTH for the client
// to know which sign-in UI to show).
export function isStandaloneAuth() {
  return (
    process.env.STANDALONE_AUTH === "1" ||
    process.env.STANDALONE_AUTH === "true" ||
    process.env.NEXT_PUBLIC_STANDALONE_AUTH === "1" ||
    process.env.NEXT_PUBLIC_STANDALONE_AUTH === "true"
  );
}
