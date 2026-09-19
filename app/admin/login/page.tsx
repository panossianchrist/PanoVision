import { AdminLogin } from "@/components/moderation/AdminLogin";
export default function LoginPage() {
  return (
    <section className="container admin-login">
      <span className="micro blue">PanoVision / Internal</span>
      <h1>Team sign in</h1>
      <AdminLogin />
    </section>
  );
}
