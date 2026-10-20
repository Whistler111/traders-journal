export const useAuth = () => ({
  user: {
    uid: "visual-fixture",
    email: "fictional@example.invalid",
    emailVerified: true,
    providerData: [],
  },
  loading: false,
  error: "",
  signOut: async () => {},
  resendVerification: async () => {},
  refreshVerification: async () => {},
});
