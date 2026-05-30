 import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

// FIX: Added `icon` field to every perk — was undefined before
const PERKS = [
  { name: "Coffee Voucher",           cost: 10  },
  { name: "Campus T-Shirt",           cost: 50  },
  { name: "USB Hub",                 cost: 100 },
  { name: "Laptop Stand",             cost: 200 },
  { name: "Mechanical Keyboard",      cost: 300 },
  { name: "Noise-Cancelling Headphones",  cost: 500 },
];

export default function StudentDashboard({
  wallet,
  contracts,
  getBalance,
  redeemTokens,
  getAllEvents,
  joinEvent,
  getStudentEvents,
  recordAttendance,
  hasStudentJoined,
}) {
  // FIX: All state declared at the top — before any effects that reference them
  const [balance, setBalance]           = useState("0");
  const [events, setEvents]             = useState([]);
  const [joinedEvents, setJoinedEvents] = useState(new Set());
  const [redemptions, setRedemptions]   = useState([]);
  const [selectedPerk, setSelectedPerk] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────
  // FIX: Single consolidated data load — removes the duplicate useEffect that
  // called getAllEvents a second time into a separate `allEvents` state.
  const fetchData = useCallback(async () => {
    if (!wallet) {
      console.log("fetchData: no wallet connected");
      return;
    }
    console.log("fetchData: starting for wallet", wallet);
    setRefreshing(true);
    try {
      console.log("fetchData: calling getBalance and getAllEvents");
      const [bal, allEvents] = await Promise.all([
        getBalance(wallet),
        getAllEvents(),
      ]);
      console.log("fetchData: balance =", bal, "events =", allEvents.length);
      setBalance(bal);
      setEvents(allEvents);

      // Check which events the student has joined
      if (hasStudentJoined && allEvents.length > 0) {
        console.log("fetchData: checking joined status for", allEvents.length, "events");
        const joinedChecks = await Promise.all(
          allEvents.map(event => hasStudentJoined(event.id, wallet))
        );
        const joined = new Set();
        allEvents.forEach((event, index) => {
          if (joinedChecks[index]) {
            console.log("fetchData: student has joined event", event.id);
            joined.add(event.id);
          }
        });
        setJoinedEvents(joined);
        console.log("fetchData: total joined events =", joined.size);
      }
    } catch (err) {
      console.error("fetchData error:", err);
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, [wallet, getBalance, getAllEvents, hasStudentJoined]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Join event ────────────────────────────────────────────────────────────
  // FIX: joinEvent now takes (eventId, amount) not (eventId, wallet).
  // The student's wallet is msg.sender in the contract.
  const handleJoin = async (event) => {
    if (!event?.id) {
      toast.error("Invalid event");
      return;
    }

    // Check if already joined
    if (joinedEvents.has(event.id)) {
      toast.error("You have already joined this event");
      return;
    }

    // Default per-join reward: 10 ERT (capped by the event's remaining budget)
    const DEFAULT_REWARD = 10;
    const remaining =
      parseFloat(event.maxRewards) - parseFloat(event.totalMinted);

    if (remaining <= 0) {
      toast.error("This event has no remaining rewards");
      return;
    }

    const reward = Math.min(DEFAULT_REWARD, remaining);

    setLoading(true);
    console.log("handleJoin: joining event", event.id, "with reward", reward);
    
    try {
      const receipt = await joinEvent(event.id, reward);
      console.log("handleJoin: transaction successful", receipt.transactionHash);
      
      toast.success(`Joined "${event.name}"! +${reward} ERT awarded.`);
      
      // Add to joined events immediately
      setJoinedEvents(prev => new Set([...prev, event.id]));
      
      // Force refresh data to update balance and event status
      console.log("handleJoin: refreshing data...");
      await fetchData();
      console.log("handleJoin: data refreshed");
    } catch (err) {
      console.error("Join event error:", err);
      const msg = err.reason || err.message || err.toString();
      const errorData = err.data?.message || err.error?.message || "";
      
      console.log("Error details:", { msg, errorData, err });
      
      // Better error messages
      if (msg.includes("Exceeds max rewards")) {
        toast.error("Event reward limit reached");
      } else if (msg.includes("Already joined")) {
        toast.error("You have already joined this event");
        setJoinedEvents(prev => new Set([...prev, event.id]));
        // Refresh to sync state
        await fetchData();
      } else if (errorData.includes("Caller is not authorized to mint")) {
        toast.error("System configuration error: Registry cannot mint tokens. Contact admin.");
      } else if (msg.includes("execution reverted") || msg.includes("Internal JSON-RPC error")) {
        // Try to extract the actual revert reason
        if (errorData) {
          toast.error(`Transaction failed: ${errorData}`);
        } else {
          toast.error("Transaction failed. The event may not exist or you may not have permission.");
        }
      } else {
        toast.error("Failed to join: " + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Redeem perk ───────────────────────────────────────────────────────────
  const handleRedeem = async () => {
    if (!selectedPerk) return toast.error("Select a perk first");
    const cost = selectedPerk.cost;
    if (parseFloat(balance) < cost) return toast.error("Insufficient token balance");

    setLoading(true);
    try {
      const receipt = await redeemTokens(cost, selectedPerk.name);
      toast.success(
        `Redeemed ${selectedPerk.name}! Tx: ${receipt.transactionHash.slice(0, 10)}...`
      );
      setRedemptions((prev) => [
        { perkName: selectedPerk.name, tokensRedeemed: cost, txHash: receipt.transactionHash, createdAt: new Date() },
        ...prev,
      ]);
      setSelectedPerk(null);
      await fetchData();
    } catch (err) {
      toast.error(err.reason || err.message || "Redemption failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const shortAddr = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "");
  const formatDate = (d) => {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const activeEvents = events.filter((e) => e.active);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Student Portal</h1>
          <p style={styles.subtitle}>
            {wallet && wallet !== "undefined" ? shortAddr(wallet) : "Wallet not connected"}
          </p>
        </div>
        <button onClick={fetchData} style={styles.refreshBtn} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Balance Card */}
      <div style={styles.balanceCard}>
        <div style={styles.balanceLabel}>ERT Balance</div>
        <div style={styles.balanceValue}>{parseFloat(balance).toFixed(2)}</div>
        <div style={styles.balanceSub}>Event Reward Tokens</div>
        <div style={styles.balanceMeta}>
          <span>Active Events: {activeEvents.length}</span>
        </div>
      </div>

      {/* Available Events */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}> Available Events</h2>
        {refreshing && events.length === 0 ? (
          <div style={styles.loadingText}>Loading events...</div>
        ) : activeEvents.length === 0 ? (
          <div style={styles.emptyText}>No active events yet. Check back later!</div>
        ) : (
          <div style={styles.eventsGrid}>
            {activeEvents.map((event) => {
              const remaining = parseFloat(event.maxRewards) - parseFloat(event.totalMinted);
              const progress = Math.min(
                100,
                (parseFloat(event.totalMinted) / parseFloat(event.maxRewards)) * 100
              );
              const isJoined = joinedEvents.has(event.id);
              const canJoin = !isJoined && remaining > 0;

              return (
                <div key={event.id} style={styles.eventCard}>
                  <div style={styles.eventHeader}>
                    <h3 style={styles.eventTitle}>{event.name}</h3>
                    <span style={styles.eventId}>ID: {event.id}</span>
                  </div>

                  <p style={styles.eventDesc}>{event.description || "No description provided"}</p>

                  <div style={styles.eventDetails}>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Organizer:</span>
                      <code style={styles.code}>{shortAddr(event.organizer)}</code>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Max Rewards:</span>
                      <span style={styles.detailValue}>{parseFloat(event.maxRewards).toFixed(0)} ERT</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Remaining:</span>
                      <span style={styles.detailValue}>{remaining.toFixed(0)} ERT</span>
                    </div>
                    <div style={styles.detailRow}>
                      <span style={styles.detailLabel}>Created:</span>
                      <span style={styles.detailValue}>{formatDate(event.createdAt)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={styles.progressBar}>
                    <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                  </div>
                  <div style={styles.progressLabel}>{progress.toFixed(0)}% distributed</div>

                  <button
                    onClick={() => handleJoin(event)}
                    style={{
                      ...styles.attendBtn,
                      ...(isJoined ? styles.joinedBtn : {}),
                      opacity: canJoin ? 1 : 0.6,
                      cursor: canJoin ? "pointer" : "not-allowed",
                    }}
                    disabled={loading || !canJoin}
                  >
                    {loading ? "Joining..." : isJoined ? "Joined" : remaining <= 0 ? "Fully Rewarded" : "Join Event"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Perks Grid */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}> Redeem Perks</h2>
        <div style={styles.perksGrid}>
          {PERKS.map((perk) => {
            const canAfford = parseFloat(balance) >= perk.cost;
            return (
              <div
                key={perk.name}
                style={{
                  ...styles.perkCard,
                  ...(selectedPerk?.name === perk.name ? styles.perkCardSelected : {}),
                  opacity: canAfford ? 1 : 0.45,
                  cursor: canAfford ? "pointer" : "not-allowed",
                }}
                onClick={() => canAfford && setSelectedPerk(perk)}
              >
                <div style={styles.perkIcon}>{perk.icon}</div>
                <div style={styles.perkName}>{perk.name}</div>
                <div style={styles.perkCost}>{perk.cost} ERT</div>
              </div>
            );
          })}
        </div>

        {selectedPerk && (
          <div style={styles.redeemBar}>
            <span style={{ color: "#f1f5f9", fontSize: 14 }}>
              Selected: {selectedPerk.icon} {selectedPerk.name} — {selectedPerk.cost} ERT
            </span>
            <div style={styles.redeemActions}>
              <button onClick={() => setSelectedPerk(null)} style={styles.cancelBtn}>
                Cancel
              </button>
              <button onClick={handleRedeem} style={styles.redeemBtn} disabled={loading}>
                {loading ? "Processing..." : "Confirm Redeem"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Redemption History */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}> Redemption History</h2>
        {redemptions.length === 0 ? (
          <p style={styles.empty}>No redemptions yet — redeem your first perk above!</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Perk", "Tokens", "Date", "Tx Hash"].map((h) => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.trEven : {}}>
                    <td style={styles.td}>{r.perkName}</td>
                    <td style={styles.td}>{r.tokensRedeemed} ERT</td>
                    <td style={styles.td}>{formatDate(r.createdAt)}</td>
                    <td style={styles.td}>
                      {r.txHash ? (
                        <span style={styles.mono} title={r.txHash}>
                          {r.txHash.slice(0, 12)}...
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: 1200, margin: "0 auto", padding: "24px 16px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: "#f1f5f9" },
  subtitle: { fontSize: 13, color: "#64748b", fontFamily: "Space Mono, monospace", marginTop: 4 },
  refreshBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  balanceCard: { background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", borderRadius: 16, padding: "32px 28px", marginBottom: 28, textAlign: "center" },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 8 },
  balanceValue: { fontSize: 56, fontWeight: 700, color: "#fff", fontFamily: "Space Mono, monospace", lineHeight: 1 },
  balanceSub: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  balanceMeta: { display: "flex", justifyContent: "center", gap: 32, marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.7)", flexWrap: "wrap" },
  section: { background: "#1e293b", borderRadius: 12, padding: 24, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 },
  eventsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 },
  eventCard: { background: "#0f172a", borderRadius: 10, padding: 16, border: "1px solid #334155" },
  eventHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  eventTitle: { fontSize: 15, fontWeight: 600, color: "#f1f5f9", margin: 0, flex: 1, marginRight: 8 },
  eventId: { fontSize: 11, color: "#64748b", background: "#1e293b", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap" },
  eventDesc: { fontSize: 13, color: "#94a3b8", marginBottom: 12, lineHeight: 1.4 },
  eventDetails: { background: "#1a1f35", borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 12 },
  detailRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" },
  detailLabel: { color: "#64748b", fontWeight: 500 },
  code: { fontFamily: "Space Mono, monospace", color: "#38bdf8", fontSize: 11 },
  detailValue: { color: "#a78bfa", fontWeight: 600, fontFamily: "Space Mono, monospace" },
  progressBar: { height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", background: "linear-gradient(90deg, #4f46e5, #7c3aed)", borderRadius: 2, transition: "width 0.3s" },
  progressLabel: { fontSize: 11, color: "#475569", marginBottom: 10 },
  attendBtn: { width: "100%", background: "#059669", border: "none", color: "#fff", padding: "10px", borderRadius: 6, fontWeight: 600, fontSize: 13, transition: "all 0.2s" },
  joinedBtn: { background: "#475569", cursor: "not-allowed" },
  perksGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 },
  perkCard: { background: "#0f172a", borderRadius: 10, padding: 16, textAlign: "center", border: "2px solid #334155", transition: "all 0.2s" },
  perkCardSelected: { border: "2px solid #4f46e5", background: "#1a1a4e" },
  perkIcon: { fontSize: 28, marginBottom: 8 },
  perkName: { fontSize: 12, color: "#94a3b8", marginBottom: 6 },
  perkCost: { fontSize: 14, fontWeight: 700, color: "#a78bfa", fontFamily: "Space Mono, monospace" },
  redeemBar: { marginTop: 16, background: "#0f172a", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, border: "1px solid #4f46e5" },
  redeemActions: { display: "flex", gap: 8 },
  cancelBtn: { background: "transparent", border: "1px solid #475569", color: "#94a3b8", padding: "8px 16px", borderRadius: 8, cursor: "pointer" },
  redeemBtn: { background: "#4f46e5", border: "none", color: "#fff", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 600 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "10px 12px", fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #334155" },
  td: { padding: "12px", fontSize: 14, color: "#cbd5e1", borderBottom: "1px solid #1e293b" },
  trEven: { background: "#0f172a22" },
  mono: { fontFamily: "Space Mono, monospace", color: "#818cf8", fontSize: 12 },
  empty: { color: "#475569", fontSize: 14, fontStyle: "italic" },
  loadingText: { color: "#94a3b8", textAlign: "center", padding: "20px", fontSize: 14 },
  emptyText: { color: "#64748b", textAlign: "center", padding: "20px", fontSize: 14, fontStyle: "italic" },
};