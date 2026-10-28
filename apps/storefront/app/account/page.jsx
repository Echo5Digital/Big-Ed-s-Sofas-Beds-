import Container from "@/components/ui/Container";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import PageHero from "@/components/ui/PageHero";
import AccountPanel from "@/components/account/AccountPanel";

export const metadata = {
  title: "Your Account | Big Ed's Sofas & Beds",
  description: "Sign in or create a Big Ed's Sofas & Beds account to track orders and check out faster.",
};

export default function AccountPage() {
  return (
    <div className="pb-10">
      <PageHero title="Account" showMascot={false} />

      <Container className="mt-8 max-w-md">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
        <AccountPanel />
      </Container>
    </div>
  );
}
