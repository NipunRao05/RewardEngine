import React, { useState } from "react";

const ROLE_INFO = {
  ADMIN: {
    icon: "",
    color: "#c084fc",
    bg: "#3b0764",
    border: "#7c3aed",
    label: "Admin",
    desc: "Manage roles, burn tokens, pause system",
  },
  ORGANIZER: {
    icon: "",
    color: "#38bdf8",
    bg: "#0c4a6e",
    border: "#0891b2",
    label: "Organizer",
    desc: "Create events, reward students with tokens",
  },
  STUDENT: {
    icon: "",
    color: "#34d399",
    bg: "#064e3b",
    border: "#059669",
    label: "Student",
    desc: "Earn tokens by attending events, redeem perks",
  },
};

// Stage 1 — before MetaMask is connected
function ConnectScreen({ onConnect, loading, error }) {
  return (
    <div style={s.card}>
      {/* Logo */}
      <div style={s.logoWrap}>
        <span style={s.logoIcon}>ER</span>
      </div>
      <h1 style={s.title}>EventReward</h1>
      <p style={s.subtitle}>Blockchain-powered event attendance rewards</p>

      {/* Role cards — just informational, not selectable */}
      <div style={s.roleGrid}>
        {Object.entries(ROLE_INFO).map(([key, info]) => (
          <div key={key} style={{ ...s.roleCard, borderColor: info.border, background: info.bg }}>
            <span style={s.roleCardIcon}>{info.icon}</span>
            <span style={{ ...s.roleCardLabel, color: info.color }}>{info.label}</span>
            <span style={s.roleCardDesc}>{info.desc}</span>
          </div>
        ))}
      </div>

      <div style={s.divider} />

      <p style={s.hint}>
        Connect your MetaMask wallet — your role is read automatically from the blockchain.
      </p>

      {!window.ethereum ? (
        <div style={s.noMeta}>
          <span> MetaMask not detected</span>
          <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" style={s.installLink}>
            Install MetaMask →
          </a>
        </div>
      ) : (
        <button onClick={onConnect} style={s.connectBtn} disabled={loading}>
          {loading ? (
            <span style={s.btnInner}>
              <span style={s.spinner} />
              Connecting...
            </span>
          ) : (
            <span style={s.btnInner}>
              <span style={s.foxIcon}>🦊</span>
              Connect MetaMask
            </span>
          )}
        </button>
      )}

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.networkBadge}>
        <span style={s.networkDot} />
        Hardhat Local · Chain ID 31337
      </div>
    </div>
  );
}

// Stage 2 — wallet connected, checking role on-chain
function CheckingRoleScreen({ wallet }) {
  const short = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "";
  return (
    <div style={s.card}>
      <div style={s.checkingWrap}>
        <div style={s.pulseRing} />
        <span style={s.chainIcon}>...</span>
      </div>
      <h2 style={s.checkingTitle}>Checking your role</h2>
      <p style={s.checkingWallet}>{short}</p>
      <p style={s.checkingDesc}>
        Reading your assigned role from the smart contract...
      </p>
      <div style={s.dotsWrap}>
        <span style={{ ...s.dot, animationDelay: "0s" }} />
        <span style={{ ...s.dot, animationDelay: "0.2s" }} />
        <span style={{ ...s.dot, animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}

// Stage 3 — role found, showing which dashboard they're entering
function RoleFoundScreen({ wallet, role, onEnter }) {
  const short = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "";
  const info = ROLE_INFO[role] || { color: "#94a3b8", bg: "#1e293b", border: "#334155", label: role, desc: "" };

  return (
    <div style={s.card}>
      <div style={{ ...s.roleFoundBadge, background: info.bg, border: `2px solid ${info.border}` }}>
        <span style={s.roleFoundIcon}>{info.icon}</span>
        <span style={{ ...s.roleFoundLabel, color: info.color }}>{info.label}</span>
      </div>

      <h2 style={s.welcomeTitle}>Welcome back</h2>
      <p style={s.welcomeWallet}>{short}</p>
      <p style={s.welcomeDesc}>{info.desc}</p>

      <button
        onClick={onEnter}
        style={{ ...s.enterBtn, background: `linear-gradient(135deg, ${info.border}, ${info.color}33)`, borderColor: info.border }}
      >
        Enter {info.label} Dashboard →
      </button>
    </div>
  );
}

// Stage 4 — wallet has no role assigned
function NoRoleScreen({ wallet, onDisconnect }) {
  const short = wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "";
  return (
    <div style={s.card}>
      <div style={s.noRoleIcon}></div>
      <h2 style={s.noRoleTitle}>No Role Assigned</h2>
      <p style={s.noRoleWallet}>{short}</p>
      <p style={s.noRoleDesc}>
        This wallet has not been assigned a role yet. Ask the <strong style={{ color: "#c084fc" }}>Admin</strong> to assign you a role, then reconnect.
      </p>
      <div style={s.noRoleSteps}>
        <div style={s.step}><span style={s.stepNum}>1</span> Admin opens Admin Dashboard</div>
        <div style={s.step}><span style={s.stepNum}>2</span> Goes to Users tab</div>
        <div style={s.step}><span style={s.stepNum}>3</span> Enters your wallet address</div>
        <div style={s.step}><span style={s.stepNum}>4</span> Assigns Organizer or Student role</div>
      </div>
      <button onClick={onDisconnect} style={s.disconnectBtn}>
        ← Disconnect &amp; Try Another Wallet
      </button>
    </div>
  );
}

// Main LoginPage — picks which screen to show based on stage
export default function LoginPage({ stage, wallet, role, error, onConnect, onEnter, onDisconnect, loading }) {
  return (
    <div style={s.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { transform: scale(1); opacity:0.6; } 50% { transform: scale(1.3); opacity:1; } }
        @keyframes bounce { 0%,100% { transform: translateY(0); opacity:0.4; } 50% { transform: translateY(-6px); opacity:1; } }
      `}</style>

      {stage === "connect"  && <ConnectScreen onConnect={onConnect} loading={loading} error={error} />}
      {stage === "checking" && <CheckingRoleScreen wallet={wallet} />}
      {stage === "found"    && <RoleFoundScreen wallet={wallet} role={role} onEnter={onEnter} />}
      {stage === "norole"   && <NoRoleScreen wallet={wallet} onDisconnect={onDisconnect} />}
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(ellipse at 50% 0%, #1e1b4b 0%, #0f172a 65%)",
    padding: 16,
  },
  card: {
    background: "#1e293b",
    borderRadius: 20,
    padding: "44px 40px",
    width: "100%",
    maxWidth: 480,
    border: "1px solid #334155",
    boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
  },

  // Logo
  logoWrap: { width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoIcon: { fontSize: 32, color: "#fff" },
  title: { fontSize: 34, fontWeight: 800, color: "#f1f5f9", letterSpacing: -1, margin: "0 0 6px" },
  subtitle: { fontSize: 14, color: "#64748b", margin: "0 0 28px" },

  // Role info cards
  roleGrid: { display: "flex", flexDirection: "column", gap: 8, width: "100%", marginBottom: 20 },
  roleCard: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid", textAlign: "left" },
  roleCardIcon: { fontSize: 20, flexShrink: 0 },
  roleCardLabel: { fontSize: 13, fontWeight: 700, width: 80, flexShrink: 0 },
  roleCardDesc: { fontSize: 12, color: "#94a3b8" },

  divider: { width: "100%", height: 1, background: "#334155", margin: "4px 0 20px" },
  hint: { fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.6 },

  // Connect button
  connectBtn: {
    width: "100%", padding: "14px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700,
    cursor: "pointer", marginBottom: 12, transition: "opacity 0.2s",
  },
  btnInner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  foxIcon: { fontSize: 20 },
  spinner: {
    width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite",
    display: "inline-block",
  },

  noMeta: { display: "flex", flexDirection: "column", gap: 8, color: "#f87171", fontSize: 14, marginBottom: 12 },
  installLink: { color: "#818cf8", textDecoration: "none", fontWeight: 600 },
  errorBox: { background: "#450a0a", border: "1px solid #dc2626", color: "#fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, width: "100%", marginBottom: 12 },
  networkBadge: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", marginTop: 4 },
  networkDot: { width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" },

  // Checking role screen
  checkingWrap: { position: "relative", width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  pulseRing: { position: "absolute", width: 80, height: 80, borderRadius: "50%", border: "2px solid #4f46e5", animation: "pulse 1.5s ease-in-out infinite" },
  chainIcon: { fontSize: 32 },
  checkingTitle: { fontSize: 22, fontWeight: 700, color: "#f1f5f9", margin: "0 0 8px" },
  checkingWallet: { fontSize: 13, color: "#64748b", fontFamily: "Space Mono, monospace", margin: "0 0 12px" },
  checkingDesc: { fontSize: 14, color: "#94a3b8", margin: "0 0 20px" },
  dotsWrap: { display: "flex", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: "50%", background: "#4f46e5", animation: "bounce 0.8s ease-in-out infinite", display: "inline-block" },

  // Role found screen
  roleFoundBadge: { width: 100, height: 100, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 20 },
  roleFoundIcon: { fontSize: 32 },
  roleFoundLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 },
  welcomeTitle: { fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" },
  welcomeWallet: { fontSize: 13, color: "#64748b", fontFamily: "Space Mono, monospace", margin: "0 0 10px" },
  welcomeDesc: { fontSize: 14, color: "#94a3b8", margin: "0 0 24px" },
  enterBtn: {
    width: "100%", padding: "13px", border: "1px solid",
    borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 700,
    cursor: "pointer", background: "transparent",
  },

  // No role screen
  noRoleIcon: { fontSize: 48, marginBottom: 12 },
  noRoleTitle: { fontSize: 22, fontWeight: 700, color: "#fcd34d", margin: "0 0 8px" },
  noRoleWallet: { fontSize: 13, color: "#64748b", fontFamily: "Space Mono, monospace", margin: "0 0 14px" },
  noRoleDesc: { fontSize: 14, color: "#94a3b8", margin: "0 0 20px", lineHeight: 1.6 },
  noRoleSteps: { display: "flex", flexDirection: "column", gap: 8, width: "100%", marginBottom: 24 },
  step: { display: "flex", alignItems: "center", gap: 10, background: "#0f172a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#94a3b8", textAlign: "left" },
  stepNum: { width: 22, height: 22, borderRadius: "50%", background: "#4f46e5", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  disconnectBtn: { background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontSize: 14, width: "100%" },
};
