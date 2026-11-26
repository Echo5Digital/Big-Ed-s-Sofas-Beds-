import { Suspense } from "react";
import AccountHero from "@/components/account/AccountHero";

export const metadata = {
  title: "Your Account | Big Ed's Sofas & Beds",
  description:
    "Sign in or create a Big Ed's Sofas & Beds account to manage your details and addresses, view your orders, and check out faster.",
};

export default function AccountPage() {
  return (
    // AccountDashboard reads ?tab= (e.g. the Return flow's post-submit
    // redirect) via useSearchParams, which needs a Suspense boundary to
    // still allow this route to be prerendered — same reason
    // app/contact/page.jsx wraps its own form in one.
    <Suspense fallback={null}>
      <AccountHero />
    </Suspense>
  );
}
