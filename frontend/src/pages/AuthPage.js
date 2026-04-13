import { useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const url = isLogin
        ? "https://whatsapp-clone-production-0db0.up.railway.app/api/auth/login"
        : "https://whatsapp-clone-production-0db0.up.railway.app/api/auth/register";
      const payload = isLogin ? { email: form.email, password: form.password } : form;
      const res = await axios.post(url, payload);
      login(res.data.user, res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.left}>
        <div style={s.brand}>
          <div style={s.brandIcon}>💬</div>
          <h1 style={s.brandName}>WhatsApp</h1>
          <p style={s.brandTagline}>Simple. Reliable. Private.</p>
        </div>
        <div style={s.features}>
          {["End-to-end encrypted", "Real-time messaging", "Always in sync"].map((f) => (
            <div key={f} style={s.featureItem}>
              <div style={s.featureDot} />
              <span style={s.featureText}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={s.right}>
        <div style={s.card}>
          <h2 style={s.cardTitle}>{isLogin ? "Welcome back" : "Create account"}</h2>
          <p style={s.cardSub}>{isLogin ? "Sign in to continue" : "Join and start chatting"}</p>

          <div style={s.tabs}>
            <button style={{ ...s.tab, ...(isLogin ? s.tabActive : {}) }} onClick={() => { setIsLogin(true); setError(""); }}>Login</button>
            <button style={{ ...s.tab, ...(!isLogin ? s.tabActive : {}) }} onClick={() => { setIsLogin(false); setError(""); }}>Register</button>
          </div>

          <div style={s.form}>
            {!isLogin && (
              <div style={s.inputGroup}>
                <label style={s.label}>Username</label>
                <input style={s.input} placeholder="Enter your username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
            )}
            <div style={s.inputGroup}>
              <label style={s.label}>Email</label>
              <input style={s.input} placeholder="Enter your email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={s.inputGroup}>
              <label style={s.label}>Password</label>
              <input style={s.input} placeholder="Enter your password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} onClick={handleSubmit} disabled={loading}>
              {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif" },
  left: { flex: 1, background: "#111", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px", gap: "40px" },
  brand: { display: "flex", flexDirection: "column", gap: "8px" },
  brandIcon: { fontSize: "40px", marginBottom: "4px" },
  brandName: { fontSize: "36px", fontWeight: "700", color: "#fff", margin: 0 },
  brandTagline: { color: "#666", fontSize: "15px", margin: 0 },
  features: { display: "flex", flexDirection: "column", gap: "16px" },
  featureItem: { display: "flex", alignItems: "center", gap: "12px" },
  featureDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#25D366", flexShrink: 0 },
  featureText: { color: "#888", fontSize: "14px" },
  right: { width: "460px", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" },
  card: { background: "#fff", borderRadius: "20px", padding: "40px", width: "100%", border: "1px solid #ebebeb" },
  cardTitle: { fontSize: "24px", fontWeight: "700", color: "#111", margin: "0 0 4px 0" },
  cardSub: { color: "#999", fontSize: "14px", margin: "0 0 28px 0" },
  tabs: { display: "flex", background: "#f5f5f5", borderRadius: "10px", padding: "4px", marginBottom: "28px", gap: "4px" },
  tab: { flex: 1, padding: "9px", border: "none", background: "transparent", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", color: "#999", transition: "all 0.2s" },
  tabActive: { background: "#fff", color: "#111", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  inputGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "12px", fontWeight: "600", color: "#555", textTransform: "uppercase", letterSpacing: "0.5px" },
  input: { padding: "12px 14px", borderRadius: "10px", border: "1px solid #e5e5e5", fontSize: "14px", outline: "none", background: "#fafafa", color: "#111" },
  error: { background: "#fff0f0", color: "#e53935", fontSize: "13px", padding: "10px 14px", borderRadius: "8px", border: "1px solid #ffd0d0" },
  btn: { padding: "13px", background: "#111", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: "600", cursor: "pointer", marginTop: "4px" },
};
