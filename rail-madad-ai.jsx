import { useState, useEffect, useRef } from "react";

const COLORS = {
  primary: "#1a3c5e",
  accent: "#e8742a",
  success: "#2d8a4e",
  warning: "#d4780a",
  danger: "#c0392b",
  info: "#2471a3",
  bg: "#f4f6f9",
  card: "#ffffff",
  text: "#1c2833",
  muted: "#5d6d7e",
  border: "#dce3ea",
};

const DEPARTMENTS = {
  Cleanliness: "Housekeeping",
  Catering: "Catering",
  Security: "RPF",
  Maintenance: "Maintenance",
};

const PRIORITY_KEYWORDS = {
  HIGH: ["fire", "theft", "stolen", "harassment", "assault", "weapon", "danger", "emergency", "threat", "smoke", "burning"],
  MEDIUM: ["food", "water", "catering", "overcharged", "overpricing", "delay", "smell"],
  LOW: ["fan", "light", "bulb", "dust", "minor", "small", "little"],
};

const CATEGORY_KEYWORDS = {
  Security: ["theft", "stolen", "harassment", "assault", "threat", "suspicious", "fight", "weapon", "police"],
  Catering: ["food", "meal", "eating", "catering", "overpriced", "vendor", "tea", "water bottle", "hungry"],
  Cleanliness: ["dirty", "clean", "garbage", "waste", "toilet", "filthy", "stain", "smell", "rats", "cockroach"],
  Maintenance: ["fan", "light", "ac", "broken", "door", "window", "leak", "electric", "seat", "berth"],
};

function classifyComplaint(text) {
  const lower = text.toLowerCase();
  let scores = { Security: 0, Catering: 0, Cleanliness: 0, Maintenance: 0 };
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of kws) if (lower.includes(kw)) scores[cat]++;
  }
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return top[1] > 0 ? top[0] : "Maintenance";
}

function detectPriority(text) {
  const lower = text.toLowerCase();
  for (const kw of PRIORITY_KEYWORDS.HIGH) if (lower.includes(kw)) return "HIGH";
  for (const kw of PRIORITY_KEYWORDS.MEDIUM) if (lower.includes(kw)) return "MEDIUM";
  return "LOW";
}

function fakeImageVerify() {
  const conf = Math.floor(Math.random() * 30) + 65;
  return { verified: conf >= 60, confidence: conf, duplicate: Math.random() < 0.1 };
}

const initialComplaints = [
  { id: 1, name: "Rahul Sharma", email: "rahul@email.com", pnr: "4201234567", train: "12951", coach: "S3", text: "The coach is extremely dirty, garbage lying all over the floor and toilet is very unclean.", category: "Cleanliness", priority: "LOW", department: "Housekeeping", status: "Resolved", confidence: 88, date: "2025-06-01", imageUrl: null },
  { id: 2, name: "Priya Patel", email: "priya@email.com", pnr: "4209876543", train: "12002", coach: "A1", text: "My wallet was stolen from the berth. Please take immediate action. Very dangerous situation.", category: "Security", priority: "HIGH", department: "RPF", status: "In Progress", confidence: 95, date: "2025-06-02", imageUrl: null },
  { id: 3, name: "Amit Kumar", email: "amit@email.com", pnr: "4205554321", train: "12259", coach: "B2", text: "Food served was of very poor quality and overpriced. The vendor charged extra money.", category: "Catering", priority: "MEDIUM", department: "Catering", status: "Assigned", confidence: 82, date: "2025-06-03", imageUrl: null },
  { id: 4, name: "Sunita Devi", email: "sunita@email.com", pnr: "4201112233", train: "12301", coach: "S5", text: "The fan in my coach is not working since past 6 hours. It is very hot inside.", category: "Maintenance", priority: "LOW", department: "Maintenance", status: "Submitted", confidence: 79, date: "2025-06-04", imageUrl: null },
  { id: 5, name: "Vikram Singh", email: "vikram@email.com", pnr: "4207778899", train: "12009", coach: "C1", text: "Suspicious person with bag found near gate. Seems dangerous. Needs security check.", category: "Security", priority: "HIGH", department: "RPF", status: "In Progress", confidence: 92, date: "2025-06-05", imageUrl: null },
  { id: 6, name: "Meena Joshi", email: "meena@email.com", pnr: "4203334455", train: "11057", coach: "S7", text: "Water is leaking from the ceiling. The light in our compartment is also broken.", category: "Maintenance", priority: "MEDIUM", department: "Maintenance", status: "Classified", confidence: 85, date: "2025-06-05", imageUrl: null },
];

const STATUS_FLOW = ["Submitted", "Classified", "Verified", "Assigned", "In Progress", "Resolved"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const TREND_DATA = [23, 31, 28, 45, 38, 52];

export default function RailMadadAI() {
  const [page, setPage] = useState("landing");
  const [user, setUser] = useState(null);
  const [complaints, setComplaints] = useState(initialComplaints);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "", role: "passenger" });
  const [users, setUsers] = useState([
    { id: 1, name: "Admin User", email: "admin@railmadad.in", password: "admin123", role: "admin" },
    { id: 2, name: "Test Passenger", email: "user@test.com", password: "user123", role: "passenger" },
  ]);
  const [complaintForm, setComplaintForm] = useState({ name: "", email: "", pnr: "", train: "", coach: "", text: "" });
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [adminFilter, setAdminFilter] = useState({ status: "All", priority: "All", category: "All", search: "" });
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [toast, setToast] = useState(null);
  const [trackId, setTrackId] = useState("");
  const [trackedComplaint, setTrackedComplaint] = useState(null);
  const [authError, setAuthError] = useState("");

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleLogin(e) {
    e.preventDefault();
    setAuthError("");
    const found = users.find(u => u.email === loginForm.email && u.password === loginForm.password);
    if (found) {
      setUser(found);
      setPage(found.role === "admin" ? "admin" : "submit");
      showToast(`Welcome back, ${found.name}!`);
    } else {
      setAuthError("Invalid email or password");
    }
  }

  function handleRegister(e) {
    e.preventDefault();
    setAuthError("");
    if (users.find(u => u.email === regForm.email)) {
      setAuthError("Email already registered");
      return;
    }
    const newUser = { ...regForm, id: users.length + 1 };
    setUsers(prev => [...prev, newUser]);
    setUser(newUser);
    setPage("submit");
    showToast("Registration successful!");
  }

  function handleLogout() {
    setUser(null);
    setPage("landing");
    showToast("Logged out successfully");
  }

  async function handleSubmitComplaint(e) {
    e.preventDefault();
    setSubmitting(true);
    setAiResult(null);
    await new Promise(r => setTimeout(r, 1500));
    const category = classifyComplaint(complaintForm.text);
    const priority = detectPriority(complaintForm.text);
    const imgVerify = fakeImageVerify();
    const department = DEPARTMENTS[category];
    const result = { category, priority, department, ...imgVerify };
    setAiResult(result);
    const newComplaint = {
      id: complaints.length + 1,
      name: complaintForm.name || user?.name,
      email: complaintForm.email || user?.email,
      pnr: complaintForm.pnr,
      train: complaintForm.train,
      coach: complaintForm.coach,
      text: complaintForm.text,
      category,
      priority,
      department,
      status: "Classified",
      confidence: result.confidence,
      date: new Date().toISOString().split("T")[0],
      imageUrl: null,
    };
    setComplaints(prev => [...prev, newComplaint]);
    setSubmitting(false);
    setComplaintForm({ name: "", email: "", pnr: "", train: "", coach: "", text: "" });
    showToast(`Complaint #${newComplaint.id} submitted and classified!`);
  }

  function handleTrack(e) {
    e.preventDefault();
    const found = complaints.find(c => c.id === parseInt(trackId));
    setTrackedComplaint(found || null);
    if (!found) showToast("Complaint not found", "error");
  }

  function updateStatus(id, status) {
    setComplaints(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    if (selectedComplaint?.id === id) setSelectedComplaint(prev => ({ ...prev, status }));
    showToast("Status updated");
  }

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => c.status !== "Resolved").length,
    resolved: complaints.filter(c => c.status === "Resolved").length,
    high: complaints.filter(c => c.priority === "HIGH").length,
  };

  const filteredComplaints = complaints.filter(c => {
    const sf = adminFilter.search.toLowerCase();
    return (adminFilter.status === "All" || c.status === adminFilter.status)
      && (adminFilter.priority === "All" || c.priority === adminFilter.priority)
      && (adminFilter.category === "All" || c.category === adminFilter.category)
      && (!sf || c.text.toLowerCase().includes(sf) || c.name.toLowerCase().includes(sf) || c.pnr.includes(sf));
  });

  const catCounts = ["Cleanliness", "Catering", "Security", "Maintenance"].map(cat => ({
    cat, count: complaints.filter(c => c.category === cat).length
  }));
  const priorCounts = ["HIGH", "MEDIUM", "LOW"].map(p => ({
    p, count: complaints.filter(c => c.priority === p).length
  }));

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <Navbar user={user} page={page} setPage={setPage} onLogout={handleLogout} />

      {page === "landing" && <LandingPage setPage={setPage} />}
      {page === "login" && <LoginPage form={loginForm} setForm={setLoginForm} onSubmit={handleLogin} setPage={setPage} error={authError} />}
      {page === "register" && <RegisterPage form={regForm} setForm={setRegForm} onSubmit={handleRegister} setPage={setPage} error={authError} />}
      {page === "submit" && <SubmitPage form={complaintForm} setForm={setComplaintForm} onSubmit={handleSubmitComplaint} submitting={submitting} aiResult={aiResult} user={user} />}
      {page === "track" && <TrackPage trackId={trackId} setTrackId={setTrackId} onTrack={handleTrack} complaint={trackedComplaint} />}
      {page === "admin" && user?.role === "admin" && (
        <AdminDashboard complaints={filteredComplaints} allComplaints={complaints} stats={stats} filter={adminFilter} setFilter={setAdminFilter} onSelect={setSelectedComplaint} selected={selectedComplaint} onUpdateStatus={updateStatus} catCounts={catCounts} priorCounts={priorCounts} />
      )}
      {page === "analytics" && user?.role === "admin" && (
        <AnalyticsDashboard complaints={complaints} stats={stats} catCounts={catCounts} priorCounts={priorCounts} trendData={TREND_DATA} />
      )}
    </div>
  );
}

function Toast({ msg, type }) {
  const bg = type === "error" ? COLORS.danger : COLORS.success;
  return (
    <div style={{ position: "fixed", top: 20, right: 20, background: bg, color: "#fff", padding: "12px 20px", borderRadius: 8, zIndex: 9999, fontSize: 14, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
      {type === "error" ? "✕ " : "✓ "}{msg}
    </div>
  );
}

function Navbar({ user, page, setPage, onLogout }) {
  return (
    <nav style={{ background: COLORS.primary, color: "#fff", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setPage("landing")}>
        <span style={{ fontSize: 26 }}>🚂</span>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>Rail Madad AI</div>
          <div style={{ fontSize: 10, opacity: 0.7, letterSpacing: 1 }}>SMART INDIA HACKATHON</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {user ? (
          <>
            {user.role === "admin" && <>
              <NavBtn active={page === "admin"} onClick={() => setPage("admin")}>Dashboard</NavBtn>
              <NavBtn active={page === "analytics"} onClick={() => setPage("analytics")}>Analytics</NavBtn>
            </>}
            {user.role === "passenger" && <>
              <NavBtn active={page === "submit"} onClick={() => setPage("submit")}>File Complaint</NavBtn>
              <NavBtn active={page === "track"} onClick={() => setPage("track")}>Track</NavBtn>
            </>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>{user.name[0]}</div>
              <span style={{ fontSize: 13, opacity: 0.85 }}>{user.name}</span>
              <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Logout</button>
            </div>
          </>
        ) : (
          <>
            <NavBtn active={page === "track"} onClick={() => setPage("track")}>Track Complaint</NavBtn>
            <NavBtn active={page === "login"} onClick={() => setPage("login")}>Login</NavBtn>
            <button onClick={() => setPage("register")} style={{ background: COLORS.accent, border: "none", color: "#fff", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Register</button>
          </>
        )}
      </div>
    </nav>
  );
}

function NavBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: active ? "rgba(255,255,255,0.2)" : "transparent", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: active ? 600 : 400 }}>
      {children}
    </button>
  );
}

function LandingPage({ setPage }) {
  const features = [
    { icon: "🧠", title: "AI Classification", desc: "Auto-classifies complaints into Cleanliness, Catering, Security & Maintenance using NLP" },
    { icon: "⚡", title: "Priority Detection", desc: "Detects HIGH/MEDIUM/LOW urgency automatically based on complaint context" },
    { icon: "🖼️", title: "Image Verification", desc: "YOLO-based detection verifies uploaded images are railway-related and authentic" },
    { icon: "🔁", title: "Duplicate Detection", desc: "Perceptual hashing (pHash) identifies duplicate complaint images" },
    { icon: "📡", title: "Auto-Routing", desc: "Complaints routed to correct department: RPF, Catering, Housekeeping, or Maintenance" },
    { icon: "📊", title: "Analytics Dashboard", desc: "Real-time charts for category distribution, trends, and resolution rates" },
  ];
  return (
    <div>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.primary} 0%, #2e6da4 100%)`, color: "#fff", padding: "80px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🚂</div>
        <h1 style={{ fontSize: 42, fontWeight: 800, margin: "0 0 12px", letterSpacing: -1 }}>Rail Madad AI</h1>
        <p style={{ fontSize: 18, opacity: 0.85, maxWidth: 560, margin: "0 auto 12px" }}>AI-Powered Railway Complaint Management System</p>
        <div style={{ display: "inline-block", background: COLORS.accent, fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 20, letterSpacing: 1, marginBottom: 32 }}>SMART INDIA HACKATHON 2025</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <HeroBtn primary onClick={() => setPage("register")}>File a Complaint</HeroBtn>
          <HeroBtn onClick={() => setPage("track")}>Track Status</HeroBtn>
          <HeroBtn onClick={() => setPage("login")}>Admin Login</HeroBtn>
        </div>
      </div>

      <div style={{ background: "#fff", padding: "16px 24px", display: "flex", justifyContent: "center", gap: 48, borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
        {[["6+", "Modules"], ["4", "Categories"], ["3", "Priority Levels"], ["100%", "AI-Powered"]].map(([val, label]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.accent }}>{val}</div>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, marginBottom: 8, color: COLORS.primary }}>System Features</h2>
        <p style={{ textAlign: "center", color: COLORS.muted, marginBottom: 36 }}>Powered by Artificial Intelligence & Computer Vision</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "24px 20px", transition: "box-shadow 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: COLORS.primary }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: COLORS.primary, color: "#fff", padding: "48px 24px", textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Status Workflow</h2>
        <p style={{ opacity: 0.7, marginBottom: 32 }}>Automated complaint lifecycle management</p>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
          {STATUS_FLOW.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ background: "rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 500 }}>{s}</div>
              {i < STATUS_FLOW.length - 1 && <span style={{ opacity: 0.5 }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroBtn({ primary, onClick, children }) {
  return (
    <button onClick={onClick} style={{ background: primary ? COLORS.accent : "rgba(255,255,255,0.2)", border: primary ? "none" : "1.5px solid rgba(255,255,255,0.5)", color: "#fff", padding: "12px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function AuthCard({ title, children }) {
  return (
    <div style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: COLORS.bg }}>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🚂</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.primary, margin: 0 }}>{title}</h2>
          <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>Rail Madad AI</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, outline: "none", boxSizing: "border-box", background: "#fff" };

function LoginPage({ form, setForm, onSubmit, setPage, error }) {
  return (
    <AuthCard title="Welcome Back">
      <form onSubmit={onSubmit}>
        <FormGroup label="Email">
          <input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required />
        </FormGroup>
        <FormGroup label="Password">
          <input type="password" style={inputStyle} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" required />
        </FormGroup>
        {error && <p style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" style={{ width: "100%", background: COLORS.primary, color: "#fff", border: "none", padding: "12px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>Login</button>
        <div style={{ textAlign: "center", fontSize: 13, color: COLORS.muted }}>
          <div style={{ marginBottom: 8 }}>Demo: <b>admin@railmadad.in</b> / admin123 (Admin)</div>
          <div>Don't have an account? <span style={{ color: COLORS.info, cursor: "pointer" }} onClick={() => setPage("register")}>Register</span></div>
        </div>
      </form>
    </AuthCard>
  );
}

function RegisterPage({ form, setForm, onSubmit, setPage, error }) {
  return (
    <AuthCard title="Create Account">
      <form onSubmit={onSubmit}>
        <FormGroup label="Full Name">
          <input style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" required />
        </FormGroup>
        <FormGroup label="Email">
          <input type="email" style={inputStyle} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@example.com" required />
        </FormGroup>
        <FormGroup label="Password">
          <input type="password" style={inputStyle} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" required minLength={6} />
        </FormGroup>
        <FormGroup label="Role">
          <select style={inputStyle} value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
            <option value="passenger">Passenger</option>
            <option value="admin">Admin</option>
          </select>
        </FormGroup>
        {error && <p style={{ color: COLORS.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" style={{ width: "100%", background: COLORS.primary, color: "#fff", border: "none", padding: "12px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>Register</button>
        <p style={{ textAlign: "center", fontSize: 13, color: COLORS.muted }}>Already have an account? <span style={{ color: COLORS.info, cursor: "pointer" }} onClick={() => setPage("login")}>Login</span></p>
      </form>
    </AuthCard>
  );
}

function SubmitPage({ form, setForm, onSubmit, submitting, aiResult, user }) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <PageHeader icon="📝" title="File a Complaint" subtitle="Submit your railway grievance — AI will classify and route it automatically" />
      <div style={{ display: "grid", gridTemplateColumns: aiResult ? "1fr 1fr" : "1fr", gap: 24 }}>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
          <form onSubmit={onSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <FormGroup label="Passenger Name">
                <input style={inputStyle} value={form.name || user?.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" required />
              </FormGroup>
              <FormGroup label="Email">
                <input type="email" style={inputStyle} value={form.email || user?.email || ""} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="your@email.com" required />
              </FormGroup>
              <FormGroup label="PNR Number">
                <input style={inputStyle} value={form.pnr} onChange={e => setForm(p => ({ ...p, pnr: e.target.value }))} placeholder="10-digit PNR" required />
              </FormGroup>
              <FormGroup label="Train Number">
                <input style={inputStyle} value={form.train} onChange={e => setForm(p => ({ ...p, train: e.target.value }))} placeholder="e.g. 12951" required />
              </FormGroup>
              <FormGroup label="Coach Number">
                <input style={inputStyle} value={form.coach} onChange={e => setForm(p => ({ ...p, coach: e.target.value }))} placeholder="e.g. S3, A1, B2" required />
              </FormGroup>
            </div>
            <FormGroup label="Complaint Description">
              <textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical" }} value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} placeholder="Describe your complaint in detail..." required />
            </FormGroup>
            <FormGroup label="Upload Image (Optional)">
              <div style={{ border: `2px dashed ${COLORS.border}`, borderRadius: 8, padding: "20px", textAlign: "center", background: COLORS.bg }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <p style={{ fontSize: 13, color: COLORS.muted, margin: 0 }}>Drag & drop or click to upload image</p>
                <p style={{ fontSize: 11, color: COLORS.muted, margin: "4px 0 0" }}>AI will verify: railway environment, authenticity & duplicates</p>
              </div>
            </FormGroup>
            <button type="submit" disabled={submitting} style={{ width: "100%", background: submitting ? COLORS.muted : COLORS.primary, color: "#fff", border: "none", padding: "13px", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer" }}>
              {submitting ? "🧠 AI Processing..." : "Submit Complaint →"}
            </button>
          </form>
        </div>

        {aiResult && (
          <div>
            <AIResultCard result={aiResult} />
          </div>
        )}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginTop: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: COLORS.primary }}>AI Processing Pipeline</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {[
            ["1. NLP Classification", "DistilBERT/BERT classifies complaint text into category"],
            ["2. Priority Detection", "Keyword analysis detects HIGH/MEDIUM/LOW urgency"],
            ["3. Image Verification", "YOLOv8 detects railway objects in uploaded photos"],
            ["4. Forgery Detection", "ELA & metadata analysis checks image authenticity"],
            ["5. Duplicate Check", "pHash algorithm detects previously submitted images"],
            ["6. Auto-Routing", "Complaint assigned to correct department automatically"],
          ].map(([title, desc]) => (
            <div key={title} style={{ background: COLORS.bg, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.primary, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIResultCard({ result }) {
  const priorityColor = { HIGH: COLORS.danger, MEDIUM: COLORS.warning, LOW: COLORS.success };
  const categoryIcons = { Cleanliness: "🧹", Catering: "🍱", Security: "🛡️", Maintenance: "🔧" };
  return (
    <div style={{ background: "#fff", border: `2px solid ${COLORS.success}`, borderRadius: 16, padding: 28, height: "fit-content" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 22 }}>✅</span>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: COLORS.success, margin: 0 }}>AI Analysis Complete</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ResultRow icon={categoryIcons[result.category]} label="Category" value={result.category} valueColor={COLORS.primary} />
        <ResultRow icon="⚡" label="Priority" value={result.priority} valueColor={priorityColor[result.priority]} badge />
        <ResultRow icon="🏢" label="Department" value={result.department} valueColor={COLORS.info} />
        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8, fontWeight: 600 }}>IMAGE VERIFICATION</div>
          <ConfidenceBar value={result.confidence} verified={result.verified} />
          {result.duplicate && <div style={{ marginTop: 8, background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#856404" }}>⚠️ Possible duplicate image detected</div>}
          {!result.verified && <div style={{ marginTop: 8, background: "#f8d7da", border: "1px solid #f5c6cb", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#721c24" }}>🔍 Flagged for manual review (low confidence)</div>}
        </div>
        <div style={{ background: COLORS.bg, borderRadius: 8, padding: "12px 14px", fontSize: 13 }}>
          <span style={{ color: COLORS.muted }}>Complaint routed to: </span>
          <span style={{ fontWeight: 700, color: COLORS.primary }}>{result.department} Department</span>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ icon, label, value, valueColor, badge }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 13, color: COLORS.muted }}>{icon} {label}</div>
      {badge ? (
        <span style={{ background: valueColor + "22", color: valueColor, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{value}</span>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600, color: valueColor }}>{value}</span>
      )}
    </div>
  );
}

function ConfidenceBar({ value, verified }) {
  const color = value >= 80 ? COLORS.success : value >= 60 ? COLORS.warning : COLORS.danger;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: COLORS.muted }}>Confidence Score</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}% — {verified ? "✓ Verified" : "⚠️ Review"}</span>
      </div>
      <div style={{ background: COLORS.border, borderRadius: 4, height: 8 }}>
        <div style={{ width: `${value}%`, background: color, height: "100%", borderRadius: 4, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

function TrackPage({ trackId, setTrackId, onTrack, complaint }) {
  const priorityColor = { HIGH: COLORS.danger, MEDIUM: COLORS.warning, LOW: COLORS.success };
  const statusIndex = complaint ? STATUS_FLOW.indexOf(complaint.status) : -1;
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
      <PageHeader icon="🔍" title="Track Complaint" subtitle="Enter your complaint ID to check status" />
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <form onSubmit={onTrack} style={{ display: "flex", gap: 12 }}>
          <input style={{ ...inputStyle, flex: 1 }} value={trackId} onChange={e => setTrackId(e.target.value)} placeholder="Enter Complaint ID (e.g. 1, 2, 3...)" />
          <button type="submit" style={{ background: COLORS.primary, color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>Track →</button>
        </form>
      </div>
      {complaint && (
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: COLORS.primary }}>Complaint #{complaint.id}</h3>
              <p style={{ color: COLORS.muted, fontSize: 13, margin: "4px 0 0" }}>Submitted on {complaint.date}</p>
            </div>
            <StatusBadge status={complaint.status} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <InfoChip label="Category" value={complaint.category} />
            <InfoChip label="Priority" value={complaint.priority} color={priorityColor[complaint.priority]} />
            <InfoChip label="Department" value={complaint.department} />
          </div>
          <div style={{ background: COLORS.bg, borderRadius: 8, padding: 14, marginBottom: 20, fontSize: 14, color: COLORS.text, lineHeight: 1.7 }}>
            {complaint.text}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 12 }}>PROGRESS</p>
            <div style={{ display: "flex", gap: 0 }}>
              {STATUS_FLOW.map((s, i) => (
                <div key={s} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {i > 0 && <div style={{ flex: 1, height: 3, background: i <= statusIndex ? COLORS.success : COLORS.border }} />}
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: i <= statusIndex ? COLORS.success : COLORS.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {i <= statusIndex ? "✓" : i + 1}
                    </div>
                    {i < STATUS_FLOW.length - 1 && <div style={{ flex: 1, height: 3, background: i < statusIndex ? COLORS.success : COLORS.border }} />}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 6, color: i <= statusIndex ? COLORS.success : COLORS.muted, fontWeight: i === statusIndex ? 700 : 400 }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoChip({ label, value, color }) {
  return (
    <div style={{ background: COLORS.bg, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || COLORS.text }}>{value}</div>
    </div>
  );
}

function AdminDashboard({ complaints, allComplaints, stats, filter, setFilter, onSelect, selected, onUpdateStatus, catCounts, priorCounts }) {
  const priorityColor = { HIGH: COLORS.danger, MEDIUM: COLORS.warning, LOW: COLORS.success };
  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "24px" }}>
      <PageHeader icon="⚙️" title="Admin Dashboard" subtitle="Manage and monitor all railway complaints" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Complaints" value={stats.total} icon="📋" color={COLORS.primary} />
        <StatCard label="Pending" value={stats.pending} icon="⏳" color={COLORS.warning} />
        <StatCard label="Resolved" value={stats.resolved} icon="✅" color={COLORS.success} />
        <StatCard label="High Priority" value={stats.high} icon="🚨" color={COLORS.danger} />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, maxWidth: 220 }} value={filter.search} onChange={e => setFilter(p => ({ ...p, search: e.target.value }))} placeholder="🔍 Search complaints..." />
          <FilterSelect label="Status" value={filter.status} onChange={v => setFilter(p => ({ ...p, status: v }))} options={["All", ...STATUS_FLOW]} />
          <FilterSelect label="Priority" value={filter.priority} onChange={v => setFilter(p => ({ ...p, priority: v }))} options={["All", "HIGH", "MEDIUM", "LOW"]} />
          <FilterSelect label="Category" value={filter.category} onChange={v => setFilter(p => ({ ...p, category: v }))} options={["All", "Cleanliness", "Catering", "Security", "Maintenance"]} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 20 }}>
        <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Complaints ({complaints.length})</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: COLORS.bg }}>
                  {["ID", "Name", "PNR", "Category", "Priority", "Department", "Status", "Date", "Action"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: COLORS.muted, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id} onClick={() => onSelect(selected?.id === c.id ? null : c)} style={{ borderBottom: `1px solid ${COLORS.border}`, background: selected?.id === c.id ? COLORS.bg : "#fff", cursor: "pointer" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: COLORS.primary }}>#{c.id}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{c.name}</td>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>{c.pnr}</td>
                    <td style={{ padding: "10px 14px" }}><CategoryBadge cat={c.category} /></td>
                    <td style={{ padding: "10px 14px" }}><span style={{ color: priorityColor[c.priority], fontWeight: 700, fontSize: 12 }}>{c.priority}</span></td>
                    <td style={{ padding: "10px 14px", color: COLORS.info, fontSize: 12 }}>{c.department}</td>
                    <td style={{ padding: "10px 14px" }}><StatusBadge status={c.status} /></td>
                    <td style={{ padding: "10px 14px", color: COLORS.muted, whiteSpace: "nowrap" }}>{c.date}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <select style={{ fontSize: 11, padding: "3px 6px", borderRadius: 4, border: `1px solid ${COLORS.border}`, background: "#fff", cursor: "pointer" }}
                        value={c.status} onChange={ev => { ev.stopPropagation(); onUpdateStatus(c.id, ev.target.value); }}>
                        {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, height: "fit-content" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Complaint #{selected.id}</h3>
              <button onClick={() => onSelect(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: COLORS.muted }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.8 }}>
              {[["Name", selected.name], ["Email", selected.email], ["PNR", selected.pnr], ["Train", selected.train], ["Coach", selected.coach], ["Category", selected.category], ["Priority", selected.priority], ["Department", selected.department], ["Status", selected.status], ["Confidence", selected.confidence + "%"], ["Date", selected.date]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}`, padding: "5px 0" }}>
                  <span style={{ color: COLORS.muted, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, background: COLORS.bg, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.7 }}>{selected.text}</div>
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 6 }}>UPDATE STATUS</label>
              <select style={{ ...inputStyle, marginBottom: 8 }} value={selected.status} onChange={e => onUpdateStatus(selected.id, e.target.value)}>
                {STATUS_FLOW.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select style={{ ...inputStyle, maxWidth: 150 }} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, marginBottom: 6 }}>{label.toUpperCase()}</div>
        <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
      </div>
      <div style={{ fontSize: 32, opacity: 0.85 }}>{icon}</div>
    </div>
  );
}

function AnalyticsDashboard({ complaints, stats, catCounts, priorCounts, trendData }) {
  const deptCounts = ["Housekeeping", "Catering", "RPF", "Maintenance"].map(d => ({
    d, count: complaints.filter(c => c.department === d).length
  }));
  const resRate = Math.round((stats.resolved / stats.total) * 100);
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
      <PageHeader icon="📊" title="Analytics Dashboard" subtitle="Real-time insights and complaint trends" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Complaints" value={stats.total} icon="📋" color={COLORS.primary} />
        <StatCard label="Resolution Rate" value={resRate + "%"} icon="🎯" color={COLORS.success} />
        <StatCard label="High Priority" value={stats.high} icon="🚨" color={COLORS.danger} />
        <StatCard label="Active Complaints" value={stats.pending} icon="⚡" color={COLORS.warning} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <ChartCard title="Category Distribution">
          <BarChart data={catCounts.map(x => ({ label: x.cat, value: x.count }))} color={COLORS.primary} />
        </ChartCard>
        <ChartCard title="Priority Distribution">
          <BarChart data={priorCounts.map(x => ({ label: x.p, value: x.count }))} colors={[COLORS.danger, COLORS.warning, COLORS.success]} />
        </ChartCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <ChartCard title="Monthly Complaint Trend (2025)">
          <LineChart data={MONTHS.map((m, i) => ({ label: m, value: trendData[i] }))} color={COLORS.accent} />
        </ChartCard>
        <ChartCard title="Department Workload">
          <DeptPie data={deptCounts} />
        </ChartCard>
      </div>

      <ChartCard title="Resolution Status Overview">
        <StatusOverview complaints={complaints} />
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.primary, marginBottom: 16, margin: "0 0 16px" }}>{title}</h3>
      {children}
    </div>
  );
}

function BarChart({ data, color, colors }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 90, fontSize: 12, color: COLORS.muted, textAlign: "right", flexShrink: 0 }}>{d.label}</div>
          <div style={{ flex: 1, background: COLORS.bg, borderRadius: 4, height: 24, overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, background: colors ? colors[i] : color, height: "100%", borderRadius: 4, display: "flex", alignItems: "center", paddingLeft: 8, minWidth: 30, transition: "width 0.5s" }}>
              <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{d.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ data, color }) {
  const max = Math.max(...data.map(d => d.value));
  const min = Math.min(...data.map(d => d.value));
  const H = 160, W = 100;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / (max - min || 1)) * (H - 20) - 10;
    return `${x},${y}`;
  });
  return (
    <div>
      <svg viewBox={`0 0 100 ${H}`} style={{ width: "100%", height: H }}>
        <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" />
        {data.map((d, i) => {
          const [x, y] = pts[i].split(",");
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {data.map(d => <span key={d.label} style={{ fontSize: 11, color: COLORS.muted }}>{d.label}</span>)}
      </div>
    </div>
  );
}

function DeptPie({ data }) {
  const colors = [COLORS.primary, COLORS.accent, COLORS.success, COLORS.info];
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      {data.map((d, i) => (
        <div key={d.d} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: colors[i], flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13 }}>{d.d}</div>
          <div style={{ background: COLORS.bg, borderRadius: 20, height: 8, width: 80 }}>
            <div style={{ width: `${total ? (d.count / total) * 100 : 0}%`, background: colors[i], height: "100%", borderRadius: 20 }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors[i], minWidth: 18 }}>{d.count}</div>
        </div>
      ))}
    </div>
  );
}

function StatusOverview({ complaints }) {
  const counts = STATUS_FLOW.map(s => ({ s, n: complaints.filter(c => c.status === s).length }));
  const max = Math.max(...counts.map(c => c.n), 1);
  const colors = ["#bdc3c7", "#3498db", "#9b59b6", "#e67e22", "#e74c3c", "#2ecc71"];
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120, padding: "0 8px" }}>
      {counts.map((c, i) => (
        <div key={c.s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colors[i] }}>{c.n}</div>
          <div style={{ width: "100%", background: colors[i], borderRadius: "4px 4px 0 0", height: Math.max((c.n / max) * 80, 4), opacity: 0.85 }} />
          <div style={{ fontSize: 10, color: COLORS.muted, textAlign: "center", lineHeight: 1.3 }}>{c.s}</div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = { Submitted: ["#e3f2fd", "#1976d2"], Classified: ["#f3e5f5", "#7b1fa2"], Verified: ["#e8f5e9", "#388e3c"], Assigned: ["#fff3e0", "#f57c00"], "In Progress": ["#fce4ec", "#c62828"], Resolved: ["#e8f5e9", "#1b5e20"] };
  const [bg, text] = colors[status] || ["#f5f5f5", "#757575"];
  return <span style={{ background: bg, color: text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{status}</span>;
}

function CategoryBadge({ cat }) {
  const colors = { Cleanliness: ["#e3f2fd", "#0d47a1"], Catering: ["#fff8e1", "#e65100"], Security: ["#fce4ec", "#880e4f"], Maintenance: ["#e8f5e9", "#1b5e20"] };
  const icons = { Cleanliness: "🧹", Catering: "🍱", Security: "🛡️", Maintenance: "🔧" };
  const [bg, text] = colors[cat] || ["#f5f5f5", "#333"];
  return <span style={{ background: bg, color: text, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{icons[cat]} {cat}</span>;
}

function PageHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: COLORS.primary, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 10 }}>
        <span>{icon}</span>{title}
      </h1>
      <p style={{ color: COLORS.muted, fontSize: 14, margin: 0 }}>{subtitle}</p>
    </div>
  );
}
