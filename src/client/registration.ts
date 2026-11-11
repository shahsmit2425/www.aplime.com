// Authenticate ownership before exposing verification or loading an existing account.
export async function createOrResume<T>(
  create: () => Promise<T>,
  signIn: () => Promise<T>,
): Promise<{ credential: T; created: boolean }> {
  try {
    return { credential: await create(), created: true };
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error &&
      error.code === "auth/email-already-in-use")) throw error;
    return { credential: await signIn(), created: false };
  }
}
