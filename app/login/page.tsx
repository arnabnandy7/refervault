import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { getAdmin } from "@/lib/session";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/dashboard");
  return (
    <main className="login-shell">
      <section className="story-panel" aria-label="About ReferVault">
        <Brand />
        <div className="story-content">
          <span className="eyebrow">
            <span />
            GOOD PEOPLE. NEW POSSIBILITIES.
          </span>
          <h1>
            A little organization.
            <br />A lot of <em>opportunity.</em>
          </h1>
          <p className="story-description">
            Keep the people you believe in, and the doors
            <br className="desktop-break" /> you open for them, all in one
            place.
          </p>
          <div className="referral-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-dot dot-one" />
            <div className="art-dot dot-two" />
            <div className="profile-card">
              <div className="card-top">
                <span className="avatar">AK</span>
                <span className="card-person">
                  <strong>A promising connection</strong>
                  <span>Ready for their next chapter</span>
                </span>
                <span className="card-star">✧</span>
              </div>
              <div className="card-rule" />
              <div className="card-bottom">
                <span className="mini-label">THE NEXT STEP</span>
                <span className="status-pill">
                  <i />
                  Referred
                </span>
              </div>
            </div>
            <div className="connection-note">
              <span>↗</span> A door worth opening.
            </div>
            <div className="art-spark">✳</div>
          </div>
          <div className="story-features">
            <span>
              <i>✓</i> Every profile
            </span>
            <span>
              <i>✓</i> Every referral
            </span>
            <span>
              <i>✓</i> Every next step
            </span>
          </div>
        </div>
        <p className="story-footer">Built for the connections that count.</p>
      </section>
      <section className="signin-panel" aria-labelledby="signin-heading">
        <div className="panel-top">
          <span className="private-label">
            <span />
            PERSONAL WORKSPACE
          </span>
          <span className="edition">01 / SIGN IN</span>
        </div>
        <div className="signin-content">
          <div className="welcome-symbol" aria-hidden="true">
            ↗
          </div>
          <span className="eyebrow form-eyebrow">
            YOUR NEXT CHAPTER STARTS HERE
          </span>
          <h2 id="signin-heading">Welcome back.</h2>
          <p className="signin-description">
            Good to see you. Let’s pick up where you left off.
          </p>
          <LoginForm />
          <div className="access-note">
            <strong>Your vault. Your circle.</strong>
            <p>
              Sign in with your admin account to access
              <br />
              your personal referral workspace.
            </p>
          </div>
        </div>
        <footer className="signin-footer">
          <span>© {new Date().getFullYear()} ReferVault</span>
          <span>
            Made for meaningful connections <span aria-hidden="true">↗</span>
          </span>
        </footer>
      </section>
    </main>
  );
}
