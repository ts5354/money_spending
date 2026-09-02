import { SignOutButton } from "@clerk/nextjs";

export function AccessDenied() {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 px-6 py-16 text-center shadow-card" aria-labelledby="access-denied-heading">
      <h1 id="access-denied-heading" className="text-2xl font-bold text-red-950">
        このアプリへのアクセス権がありません
      </h1>
      <p className="mx-auto mt-3 max-w-lg leading-7 text-red-800">
        許可されたアカウントでサインインし直してください。
      </p>
      <SignOutButton redirectUrl="/sign-in">
        <button type="button" className="mt-7 min-h-11 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">
          サインアウト
        </button>
      </SignOutButton>
    </section>
  );
}
