type IdentityStripe = {
  verifyIdentity: (
    secret: string,
  ) => Promise<{ error?: { code?: string; message?: string } }>;
};
type StripeWindow = Window & { Stripe?: (key: string) => IdentityStripe };
let loading: Promise<void> | undefined;
async function loadStripeScript() {
  if ((window as StripeWindow).Stripe) return;
  if (!loading)
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      // Stripe.js must be served directly by Stripe. Load it only for verification.
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      const timer = setTimeout(() => {
        script.remove();
        reject(
          new Error(
            "Stripe could not load. Try again or use the secure Stripe page.",
          ),
        );
      }, 20000);
      script.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(
          new Error(
            "Stripe could not load. Try again or use the secure Stripe page.",
          ),
        );
      };
      document.head.appendChild(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  await loading;
}
export async function verifyWithStripe(key: string, secret: string) {
  await loadStripeScript();
  const stripe = (window as StripeWindow).Stripe?.(key);
  if (!stripe)
    throw new Error(
      "Stripe could not load. Use the secure Stripe page to continue.",
    );
  return stripe.verifyIdentity(secret);
}
