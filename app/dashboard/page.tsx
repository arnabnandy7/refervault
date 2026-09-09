import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/session";
import { Brand } from "@/components/brand";
import { logout } from "@/app/login/actions";

export default async function Dashboard() {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return (
    <main className="workspace">
      <header>
        <Brand />
        <form action={logout}>
          <button className="logout-button">Sign out ↗</button>
        </form>
      </header>
      <section className="workspace-welcome">
        <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
        <h1>You’re in.</h1>
        <p>
          Signed in as <strong>{admin.email}</strong>.
        </p>
        <div className="workspace-empty">
          <span aria-hidden="true">✳</span>
          <h2>A home for your next referral.</h2>
          <p>
            Your login is ready. Candidate profiles and referral tracking are
            coming next.
          </p>
        </div>
      </section>
    </main>
  );
}
