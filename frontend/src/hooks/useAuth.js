import { useState, useCallback, useEffect } from "react";

const clearSession = () => {
  localStorage.removeItem("wallet");
  localStorage.removeItem("role");
};

export const useAuth = () => {
  const [wallet, setWallet] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // On mount: check if MetaMask already has the same account active
  useEffect(() => {
    const restoreSession = async () => {
      if (!window.ethereum) return;
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const currentAccount = accounts[0]?.toLowerCase();
        const savedWallet = localStorage.getItem("wallet")?.toLowerCase();
        const savedRole = localStorage.getItem("role");

        if (currentAccount && savedWallet && currentAccount === savedWallet) {
          setWallet(accounts[0]);
          if (savedRole) setRole(savedRole);
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      }
    };
    restoreSession();
  }, []);

  // Listen for MetaMask account switches
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        // MetaMask locked
        clearSession();
        setWallet(null);
        setRole(null);
      } else if (accounts[0].toLowerCase() !== wallet?.toLowerCase()) {
        // Different account selected
        clearSession();
        setWallet(null);
        setRole(null);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [wallet]);

  const connectWallet = useCallback(async (selectedRole = "STUDENT") => {
    if (!window.ethereum) {
      setError("MetaMask not found. Please install it.");
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      setWallet(address);
      setRole(selectedRole);
      localStorage.setItem("wallet", address);
      localStorage.setItem("role", selectedRole);
      return { address, role: selectedRole };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const setUserRole = useCallback((newRole) => {
    setRole(newRole);
    localStorage.setItem("role", newRole);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    localStorage.removeItem("role");
    setWallet(null);
    setRole(null);
  }, []);

  return {
    wallet,
    role,
    loading,
    error,
    connectWallet,
    setUserRole,
    logout,
    isAuthenticated: !!wallet,
  };
};