import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

export default function OrganizerDashboard({ wallet, contracts, mintTokens, registerEvent, getAllEvents }) {
  const [events, setEvents]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [activeTab, setActiveTab]     = useState("events");
  const [userRole, setUserRole]       = useState(null);
  const [rewardHistory, setRewardHistory] = useState([]);

  const [eventForm, setEventForm]   = useState({ name: "", description: "", maxRewards: "" });
  const [rewardForm, setRewardForm] = useState({ studentWallet: "", amount: "", eventId: "" });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  // ── Load this organizer's events ──────────────────────────────────────────
  const fetchOrganizerEvents = useCallback(async () => {
    if (!wallet || !contracts?.registry) return;
    try {
      const allEvents = await getAllEvents();
      const myEvents = allEvents.filter(
        (e) => e.organizer?.toLowerCase() === wallet.toLowerCase()
      );
      setEvents(myEvents);
    } catch (err) {
      console.error("fetchOrganizerEvents error:", err);
    }
  }, [wallet, contracts?.registry, getAllEvents]);

  useEffect(() => {
    fetchOrganizerEvents();
    const interval = setInterval(fetchOrganizerEvents, 15000);
    return () => clearInterval(interval);
  }, [fetchOrganizerEvents]);

  // ── Check on-chain role — use roleManager (not token contract) ────────────
  // FIX: previously used contracts.token.getUserRole; now uses the authoritative
  // RoleManager contract so role reflects what the admin actually assigned.
  const refreshRole = useCallback(async () => {
    if (!contracts?.roleManager || !wallet) return;
    try {
      const role = await contracts.roleManager.getUserRole(wallet);
      setUserRole(role);
    } catch (err) {
      console.error("refreshRole error:", err);
    }
  }, [contracts?.roleManager, wallet]);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  // ── Create event ──────────────────────────────────────────────────────────
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventForm.name || !eventForm.maxRewards) {
      return toast.error("Fill all required fields");
    }
    if (!wallet) return toast.error("Wallet not connected");

    setLoading(true);
    try {
      // Verify role fresh from contract before writing
      const currentRole = await contracts.roleManager.getUserRole(wallet);
      if (currentRole !== "ORGANIZER" && currentRole !== "ADMIN") {
        return toast.error(
          `Wallet ${shortAddr(wallet)} has role: ${currentRole}. ORGANIZER role required.`
        );
      }
      setUserRole(currentRole);

      await registerEvent(eventForm.name, eventForm.description, eventForm.maxRewards);
      toast.success("Event registered on-chain!");
      setEventForm({ name: "", description: "", maxRewards: "" });
      await fetchOrganizerEvents();
    } catch (err) {
      console.error("handleCreateEvent error:", err);
      toast.error(err.reason || err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Reward student ────────────────────────────────────────────────────────
  const handleRewardStudent = async (e) => {
    e.preventDefault();
    if (!rewardForm.studentWallet || !rewardForm.amount) {
      return toast.error("Fill all required fields");
    }
    if (!rewardForm.studentWallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return toast.error("Invalid wallet address");
    }
    if (!wallet) return toast.error("Wallet not connected");

    setLoading(true);
    try {
      // Verify role fresh from contract
      const currentRole = await contracts.roleManager.getUserRole(wallet);
      if (currentRole !== "ORGANIZER" && currentRole !== "ADMIN") {
        return toast.error(
          `Wallet ${shortAddr(wallet)} has role: ${currentRole}. ORGANIZER role required.`
        );
      }
      setUserRole(currentRole);

      const receipt = await mintTokens(rewardForm.studentWallet, rewardForm.amount);
      const txHash = receipt.transactionHash;

      toast.success(`${rewardForm.amount} ERT minted! Tx: ${txHash.slice(0, 10)}...`);
      setRewardHistory((prev) => [
        {
          wallet: rewardForm.studentWallet,
          amount: rewardForm.amount,
          txHash,
          time: new Date(),
        },
        ...prev,
      ]);
      setRewardForm({ studentWallet: "", amount: "", eventId: "" });
    } catch (err) {
      console.error("handleRewardStudent error:", err);
      toast.error(err.reason || err.message || "Mint failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Organizer Dashboard</h1>
          <p style={styles.subtitle}>
            {wallet && wallet !== "undefined" ? shortAddr(wallet) : "Wallet not connected"}
            {userRole && userRole !== "NONE" && (
              <span
                style={{
                  marginLeft: 12,
                  color:
                    userRole === "ORGANIZER" ? "#34d399"
                    : userRole === "ADMIN"    ? "#818cf8"
                    : "#ef4444",
                }}
              >
                • Role: {userRole}
              </span>
            )}
            {userRole === "NONE" && (
              <span style={{ marginLeft: 12, color: "#ef4444" }}>
                •  No role — ask admin to grant ORGANIZER
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refreshRole}
          style={styles.refreshRoleBtn}
          title="Refresh role status"
          disabled={!contracts?.roleManager}
        >
           Check Role
        </button>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        {[
          { label: "Total Events",   value: events.length,                          icon: "" },
          { label: "Active Events",  value: events.filter((e) => e.active).length,  icon: "" },
          { label: "Total Rewarded", value: rewardHistory.length,                   icon: "" },
        ].map((s) => (
          <div key={s.label} style={styles.statCard}>
            <span style={styles.statIcon}>{s.icon}</span>
            <div style={styles.statValue}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {["events", "reward", "history"].map((tab) => (
          <button
            key={tab}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab)}
          >
            {{ events: " My Events", reward: " Reward Student", history: " History" }[tab]}
          </button>
        ))}
      </div>

      {/* Events Tab */}
      {activeTab === "events" && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Create New Event</h2>
          <form onSubmit={handleCreateEvent} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Event Name *</label>
              <input
                style={styles.input}
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="e.g. Web3 Hackathon 2024"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Description</label>
              <textarea
                style={{ ...styles.input, height: 80, resize: "vertical" }}
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Event description..."
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Max Rewards (ERT) *</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                value={eventForm.maxRewards}
                onChange={(e) => setEventForm({ ...eventForm, maxRewards: e.target.value })}
                placeholder="e.g. 1000"
                required
              />
            </div>
            <button type="submit" style={styles.submitBtn} disabled={loading || !contracts?.registry}>
              {loading ? "Creating..." : " Create Event"}
            </button>
          </form>

          <h2 style={{ ...styles.panelTitle, marginTop: 32 }}>My Events</h2>
          {events.length === 0 ? (
            <p style={styles.empty}>No events yet. Create your first event above!</p>
          ) : (
            <div style={styles.eventsList}>
              {events.map((ev, i) => (
                <div key={i} style={styles.eventCard}>
                  <div style={styles.eventHeader}>
                    <span style={styles.eventName}>{ev.name}</span>
                    <span style={ev.active ? styles.badgeActive : styles.badgeInactive}>
                      {ev.active ? "Active" : "Closed"}
                    </span>
                  </div>
                  <p style={styles.eventDesc}>{ev.description || "No description"}</p>
                  <div style={styles.eventMeta}>
                    <span>Max: {ev.maxRewards} ERT</span>
                    <span>Minted: {ev.totalMinted} ERT</span>
                    <span>Created: {formatDate(ev.createdAt)}</span>
                  </div>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(100, (parseFloat(ev.totalMinted) / parseFloat(ev.maxRewards)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reward Student Tab */}
      {activeTab === "reward" && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Reward a Student</h2>
          <form onSubmit={handleRewardStudent} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Student Wallet Address *</label>
              <input
                style={styles.input}
                value={rewardForm.studentWallet}
                onChange={(e) => setRewardForm({ ...rewardForm, studentWallet: e.target.value })}
                placeholder="0x..."
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Token Amount *</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                value={rewardForm.amount}
                onChange={(e) => setRewardForm({ ...rewardForm, amount: e.target.value })}
                placeholder="e.g. 100"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Link to Event (optional)</label>
              <select
                style={styles.input}
                value={rewardForm.eventId}
                onChange={(e) => setRewardForm({ ...rewardForm, eventId: e.target.value })}
              >
                <option value="">— Select event —</option>
                {events.filter((e) => e.active).map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              style={styles.submitBtn}
              disabled={loading || !contracts?.token}
            >
              {loading ? "Minting…" : " Reward Student"}
            </button>
          </form>
        </div>
      )}

      {/* Reward History Tab */}
      {activeTab === "history" && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Reward History (this session)</h2>
          {rewardHistory.length === 0 ? (
            <p style={styles.empty}>No rewards issued this session.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Wallet", "Amount", "Tx Hash", "Time"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rewardHistory.map((r, i) => (
                  <tr key={i}>
                    <td style={styles.td}><span style={styles.mono}>{shortAddr(r.wallet)}</span></td>
                    <td style={styles.td}>{r.amount} ERT</td>
                    <td style={styles.td}>
                      <span style={styles.mono}>
                        {r.txHash ? r.txHash.slice(0, 14) + "..." : "—"}
                      </span>
                    </td>
                    <td style={styles.td}>{r.time.toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 960, margin: "0 auto", padding: "24px 16px" },
  header: { marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 28, fontWeight: 700, color: "#f1f5f9" },
  subtitle: { fontSize: 13, color: "#64748b", fontFamily: "Space Mono, monospace", marginTop: 4 },
  refreshRoleBtn: { background: "#1e293b", border: "1px solid #4f46e5", color: "#818cf8", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 },
  statCard: { background: "#1e293b", borderRadius: 12, padding: 20, textAlign: "center" },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 32, fontWeight: 700, color: "#f1f5f9", fontFamily: "Space Mono, monospace", margin: "8px 0" },
  statLabel: { fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  tabs: { display: "flex", gap: 8, marginBottom: 16 },
  tab: { padding: "10px 18px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 14 },
  tabActive: { background: "#4f46e5", border: "1px solid #4f46e5", color: "#fff" },
  panel: { background: "#1e293b", borderRadius: 12, padding: 24 },
  panelTitle: { fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 },
  form: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 },
  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#94a3b8", fontWeight: 500 },
  input: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit" },
  submitBtn: { background: "#4f46e5", border: "none", color: "#fff", padding: "12px 24px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 15, width: "fit-content" },
  eventsList: { display: "flex", flexDirection: "column", gap: 12 },
  eventCard: { background: "#0f172a", borderRadius: 10, padding: 16, border: "1px solid #334155" },
  eventHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  eventName: { fontSize: 15, fontWeight: 600, color: "#f1f5f9" },
  eventDesc: { fontSize: 13, color: "#64748b", marginBottom: 10 },
  eventMeta: { display: "flex", gap: 16, fontSize: 12, color: "#475569", marginBottom: 8 },
  progressBar: { height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #4f46e5, #7c3aed)", borderRadius: 2, transition: "width 0.3s" },
  badgeActive: { background: "#064e3b", color: "#34d399", padding: "2px 8px", borderRadius: 12, fontSize: 12 },
  badgeInactive: { background: "#1f2937", color: "#6b7280", padding: "2px 8px", borderRadius: 12, fontSize: 12 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #334155" },
  td: { padding: "12px", fontSize: 14, color: "#cbd5e1", borderBottom: "1px solid #1e293b" },
  mono: { fontFamily: "Space Mono, monospace", fontSize: 12, color: "#818cf8" },
  empty: { color: "#475569", fontSize: 14, fontStyle: "italic" },
};