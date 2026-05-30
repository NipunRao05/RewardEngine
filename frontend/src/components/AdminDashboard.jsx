import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function AdminDashboard({
  wallet, contracts, addOrganizer, addStudent,
  burnTokens, pauseSystem, unpauseSystem, isPaused,
}) {
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [addUserForm, setAddUserForm] = useState({ wallet: "", role: "STUDENT", name: "" });
  const [burnForm, setBurnForm] = useState({ wallet: "", amount: "" });

  // FIX: sync paused state from chain on mount
  useEffect(() => {
    if (!contracts?.token) return;
    isPaused()
      .then(setPaused)
      .catch((err) => console.error("isPaused error:", err));
  }, [contracts?.token, isPaused]);

  // Fetch all users from contract
  useEffect(() => {
    if (contracts?.roleManager && wallet) {
      fetchUsers();
    }
  }, [contracts?.roleManager, wallet]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const allUsers = await contracts.roleManager.getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error("Failed to fetch users list");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();

    if (!addUserForm.wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return toast.error("Invalid wallet address");
    }

    setLoading(true);
    try {
      // Assign role via RoleManager
      if (addUserForm.role === "ORGANIZER") {
        await addOrganizer(addUserForm.wallet);
      } else {
        await addStudent(addUserForm.wallet);
      }

      // Verify the role was actually written on-chain
      const assignedRole = await contracts.roleManager.getUserRole(addUserForm.wallet);
      if (assignedRole !== addUserForm.role) {
        throw new Error(
          `Role mismatch: expected ${addUserForm.role}, got ${assignedRole}`
        );
      }

      toast.success(`${addUserForm.role} role assigned successfully`);
      await fetchUsers();
      setAddUserForm({ wallet: "", role: "STUDENT", name: "" });
    } catch (err) {
      console.error("Role assignment error:", err);
      toast.error(err.reason || err.message || "Role assignment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBurn = async (e) => {
    e.preventDefault();
    if (!burnForm.wallet || !burnForm.amount) return toast.error("Fill all fields");
    setLoading(true);
    try {
      await burnTokens(burnForm.wallet, burnForm.amount);
      toast.success(`Burned ${burnForm.amount} ERT from ${burnForm.wallet.slice(0, 8)}...`);
      setBurnForm({ wallet: "", amount: "" });
    } catch (err) {
      toast.error(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    setLoading(true);
    try {
      if (paused) {
        await unpauseSystem();
        setPaused(false);
        toast.success("System unpaused");
      } else {
        await pauseSystem();
        setPaused(true);
        toast.success("System paused");
      }
    } catch (err) {
      toast.error(err.reason || err.message);
    } finally {
      setLoading(false);
    }
  };

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");

  const getRoleStyle = (role) => {
    const styles = {
      ADMIN: { background: "#7c3aed", color: "#f1f5f9" },
      ORGANIZER: { background: "#0891b2", color: "#f1f5f9" },
      STUDENT: { background: "#059669", color: "#f1f5f9" },
    };
    return styles[role] || { background: "#334155", color: "#f1f5f9" };
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Admin Dashboard</h1>
          <p style={styles.subtitle}>
            {wallet && wallet !== "undefined" ? shortAddr(wallet) : "Wallet not connected"}
          </p>
        </div>
        <button
          onClick={handlePauseToggle}
          style={{ ...styles.pauseBtn, ...(paused ? styles.pauseBtnActive : {}) }}
          disabled={loading || !contracts?.token}
        >
          {paused ? "Unpause System" : "Pause System"}
        </button>
      </div>

      {paused && (
        <div style={styles.pausedBanner}>
          System is currently paused. Token minting and redemptions are disabled.
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: "view", label: " View Users" },
          { id: "users", label: " Add User" },
          { id: "burn", label: " Burn Tokens" },
        ].map((tab) => (
          <button
            key={tab.id}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* View Users Tab */}
      {activeTab === "view" && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Assigned Users & Organizers</h2>
          {loadingUsers ? (
            <div style={styles.loadingText}>Loading users...</div>
          ) : users.length === 0 ? (
            <div style={styles.emptyText}>No users assigned yet</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableCell}>Wallet Address</th>
                    <th style={styles.tableCell}>Role</th>
                    <th style={styles.tableCell}>Assigned Date</th>
                    <th style={styles.tableCell}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => (
                    <tr key={idx} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <code style={styles.walletCode}>{shortAddr(user.wallet)}</code>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ ...styles.roleBadge, ...getRoleStyle(user.role) }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {new Date(Number(user.addedAt) * 1000).toLocaleDateString()}
                      </td>
                      <td style={styles.tableCell}>
                        <span
                          style={{
                            ...styles.statusBadge,
                            ...(user.active ? styles.statusActive : styles.statusInactive),
                          }}
                        >
                          {user.active ? "Active" : " Revoked"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={fetchUsers}
            style={styles.refreshBtn}
            disabled={loadingUsers || !contracts?.roleManager}
          >
            {loadingUsers ? "Refreshing..." : " Refresh"}
          </button>
        </div>
      )}

      {/* Add User Tab */}
      {activeTab === "users" && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Add User</h2>
          <form onSubmit={handleAddUser} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Wallet Address *</label>
                <input
                  style={styles.input}
                  value={addUserForm.wallet}
                  onChange={(e) => setAddUserForm({ ...addUserForm, wallet: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Role *</label>
                <select
                  style={styles.input}
                  value={addUserForm.role}
                  onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                >
                  <option value="STUDENT">Student</option>
                  <option value="ORGANIZER">Organizer</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Full Name (optional)</label>
                <input
                  style={styles.input}
                  value={addUserForm.name}
                  onChange={(e) => setAddUserForm({ ...addUserForm, name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
            </div>
            <button
              type="submit"
              style={styles.submitBtn}
              disabled={loading || !contracts?.roleManager}
            >
              {loading ? "Adding..." : " Add User"}
            </button>
          </form>
        </div>
      )}

      {/* Burn Tokens Tab */}
      {activeTab === "burn" && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Burn Tokens</h2>
          <form onSubmit={handleBurn} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Wallet Address *</label>
                <input
                  style={styles.input}
                  value={burnForm.wallet}
                  onChange={(e) => setBurnForm({ ...burnForm, wallet: e.target.value })}
                  placeholder="0x..."
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Amount to Burn *</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={burnForm.amount}
                  onChange={(e) => setBurnForm({ ...burnForm, amount: e.target.value })}
                  placeholder="e.g. 50"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              style={{ ...styles.submitBtn, background: "#dc2626" }}
              disabled={loading || !contracts?.token}
            >
              {loading ? "Burning..." : " Burn Tokens"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 700, color: "#f1f5f9" },
  subtitle: { fontSize: 13, color: "#64748b", fontFamily: "Space Mono, monospace", marginTop: 4 },
  pauseBtn: { background: "#1e293b", border: "1px solid #dc2626", color: "#f87171", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 },
  pauseBtnActive: { background: "#dc2626", color: "#fff", border: "1px solid #dc2626" },
  pausedBanner: { background: "#7f1d1d", border: "1px solid #dc2626", color: "#fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 14 },
  tabs: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  tab: { padding: "9px 16px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13 },
  tabActive: { background: "#4f46e5", border: "1px solid #4f46e5", color: "#fff" },
  panel: { background: "#1e293b", borderRadius: 12, padding: 24 },
  panelTitle: { fontSize: 18, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  formRow: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 },
  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#94a3b8", fontWeight: 500 },
  input: { background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", fontFamily: "inherit" },
  submitBtn: { background: "#4f46e5", border: "none", color: "#fff", padding: "11px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, width: "fit-content" },
  tableWrapper: { overflowX: "auto", marginBottom: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  tableHeader: { background: "#0f172a", borderBottom: "2px solid #334155" },
  tableCell: { padding: "12px 16px", textAlign: "left", color: "#f1f5f9", borderBottom: "1px solid #334155" },
  tableRow: { transition: "background 0.2s" },
  walletCode: { fontFamily: "Space Mono, monospace", background: "#0f172a", padding: "4px 8px", borderRadius: 4, color: "#38bdf8", fontSize: 12 },
  roleBadge: { display: "inline-block", padding: "4px 12px", borderRadius: 4, fontWeight: 600, fontSize: 12 },
  statusBadge: { display: "inline-block", padding: "4px 12px", borderRadius: 4, fontWeight: 600, fontSize: 12 },
  statusActive: { background: "#065f46", color: "#86efac" },
  statusInactive: { background: "#7f1d1d", color: "#fca5a5" },
  loadingText: { color: "#94a3b8", textAlign: "center", padding: "20px", fontSize: 14 },
  emptyText: { color: "#64748b", textAlign: "center", padding: "20px", fontSize: 14, fontStyle: "italic" },
  refreshBtn: { background: "#4f46e5", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, marginTop: 8 },
};