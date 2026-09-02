import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <section className="flex justify-center py-8" aria-label="サインイン">
      <SignIn path="/sign-in" routing="path" fallbackRedirectUrl="/" />
    </section>
  );
}
