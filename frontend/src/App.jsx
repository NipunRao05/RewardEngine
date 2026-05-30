import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { ethers } from "ethers";

import StudentDashboard from "./components/StudentDashboard";
import OrganizerDashboard from "./components/OrganizerDashboard";
import AdminDashboard from "./components/AdminDashboard";
import LoginPage from "./components/LoginPage";

import { useContract } from "./hooks/useContract";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { wallet, role, connectWallet, logout, setUserRole } = useAuth();

  const {
    contracts,
    loading,
    error,
    connect,
    getBalance,
    getUserRole,
    mintTokens,
    redeemTokens,
    burnTokens,
    pauseSystem,
    unpauseSystem,
    isPaused,
    registerEvent,
    addOrganizer,
    addStudent,
    getAllEvents,
    joinEvent,
    getStudentEvents,
    recordAttendance,
    hasStudentJoined,
  } = useContract();

  // Stages: connect | checking | found | norole | dashboard
  const [stage, setStage] = useState("connect");
  const [onchainRole, setOnchainRole] = useState(null);
  const initialCheckDone = useRef(false);

  // ── CONNECT ──────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setStage("checking");
    try {
      // 1. Request MetaMask accounts (useAuth)
      await connectWallet();

      // 2. Connect ethers + load contracts — connect() returns the freshly
      //    loaded contracts directly so we don't race against setState.
      const loadedContracts = await connect();
      if (!loadedContracts?.roleManager) {
        throw new Error("Contracts failed to load. Check your .env addresses.");
      }

      // 3. Resolve the current address
      const p = new ethers.providers.Web3Provider(window.ethereum);
      const s = p.getSigner();
      const address = await s.getAddress();

      // 4. Read role from chain — getUserRole is self-contained (no state dep)
      const r = await getUserRole(address);
      console.log("handleConnect: role =", r, "for", address);

      if (r === "NONE") {
        setStage("norole");
      } else {
        setOnchainRole(r);
        setUserRole(r);
        setStage("found"); // show "Enter Dashboard" card first
      }

      toast.success("Wallet connected!");
    } catch (err) {
      console.error("handleConnect error:", err);
      toast.error(err.message || "Connection failed");
      setStage("connect");
    }
  };

  // User clicks "Enter Dashboard" on the RoleFoundScreen
  const handleEnter = () => setStage("dashboard");

  const handleDisconnect = () => {
    logout();
    setStage("connect");
    setOnchainRole(null);
    toast("Disconnected");
  };

  // ── INITIAL LOAD — restore session if MetaMask already connected ─────────
  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    const checkWallet = async () => {
      if (!window.ethereum) return;
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (!accounts.length) return;

        // getUserRole is self-contained — works even before connect() is called
        const r = await getUserRole(accounts[0]);
        console.log("initialCheck: role =", r, "for", accounts[0]);

        if (r !== "NONE") {
          // Silently restore session — go straight to dashboard
          await connect(); // load signer + contracts for write operations
          setOnchainRole(r);
          setUserRole(r);
          setStage("dashboard");
        }
      } catch (err) {
        console.error("Initial wallet check error:", err);
      }
    };

    checkWallet();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ACCOUNT SWITCH ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (!accounts.length) {
        handleDisconnect();
        return;
      }

      try {
        setStage("checking");
        const r = await getUserRole(accounts[0]);
        console.log("accountSwitch: role =", r, "for", accounts[0]);

        if (r === "NONE") {
          setOnchainRole(null);
          setUserRole(null);
          setStage("norole");
        } else {
          await connect(); // reload signer + contracts for the new account
          setOnchainRole(r);
          setUserRole(r);
          setStage("dashboard");
        }
        toast("Switched account");
      } catch (err) {
        console.error("Account switch error:", err);
        toast.error("Switch failed");
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [getUserRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HELPERS ───────────────────────────────────────────────────────────────
  const shortAddr = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "");

  // ── NON-DASHBOARD SCREENS (login flow) ───────────────────────────────────
  // ALL non-dashboard stages are handled by LoginPage, including "checking"
  if (stage !== "dashboard") {
    return (
      <>
        <Toaster position="top-right" />
        <LoginPage
          stage={stage}
          wallet={wallet}
          role={onchainRole}
          onConnect={handleConnect}
          onEnter={handleEnter}
          onDisconnect={handleDisconnect}
          loading={loading}
          error={error}
        />
      </>
    );
  }

  // ── MAIN APP ─────────────────────────────────────────────────────────────
  return (
    <div style={appStyles.root}>
      <Toaster position="top-right" />

      {/* NAVBAR */}
      <nav style={appStyles.nav}>
        <div style={appStyles.navBrand}>EventReward</div>

        <div>
          {onchainRole && (
            <span style={appStyles.badge}>{onchainRole}</span>
          )}
        </div>

        <div style={appStyles.navRight}>
          <span style={appStyles.navRole}>{onchainRole}</span>
          <span style={appStyles.navWallet}>{shortAddr(wallet)}</span>
          <button onClick={handleDisconnect} style={appStyles.disconnectBtn}>
            Disconnect
          </button>
        </div>
      </nav>

      {/* DASHBOARDS */}
      <main style={appStyles.main}>
        {loading && <div style={appStyles.loadingBar}>Loading contracts…</div>}

        {onchainRole === "ADMIN" && (
          <AdminDashboard
            wallet={wallet}
            contracts={contracts}
            addOrganizer={addOrganizer}
            addStudent={addStudent}
            burnTokens={burnTokens}
            pauseSystem={pauseSystem}
            unpauseSystem={unpauseSystem}
            isPaused={isPaused}
          />
        )}

        {onchainRole === "ORGANIZER" && (
          <OrganizerDashboard
            wallet={wallet}
            contracts={contracts}
            mintTokens={mintTokens}
            registerEvent={registerEvent}
            getAllEvents={getAllEvents}
          />
        )}

        {onchainRole === "STUDENT" && (
          <StudentDashboard
            wallet={wallet}
            contracts={contracts}
            getBalance={getBalance}
            redeemTokens={redeemTokens}
            getAllEvents={getAllEvents}
            joinEvent={joinEvent}
            getStudentEvents={getStudentEvents}
            recordAttendance={recordAttendance}
            hasStudentJoined={hasStudentJoined}
          />
        )}
      </main>
    </div>
  );
}

// ── STYLES ───────────────────────────────────────────────────────────────────
const appStyles = {
  root: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#fff",
  },
  nav: {
    height: 60,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
  },
  navBrand: {
    fontWeight: 800,
    fontSize: 18,
    color: "#a78bfa",
    letterSpacing: -0.5,
  },
  navRight: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  navRole: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: 600,
  },
  navWallet: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "Space Mono, monospace",
  },
  badge: {
    background: "#064e3b",
    color: "#34d399",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  disconnectBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "6px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
  },
  main: {
    padding: "24px 16px",
    maxWidth: 1200,
    margin: "0 auto",
  },
  loadingBar: {
    background: "#1e293b",
    color: "#94a3b8",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
  },
};