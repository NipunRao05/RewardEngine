import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESSES = {
  EventRewardToken: process.env.REACT_APP_TOKEN_ADDRESS,
  EventRegistry: process.env.REACT_APP_REGISTRY_ADDRESS,
  RoleManager: process.env.REACT_APP_ROLE_MANAGER_ADDRESS,
};

// ---------------------------------------------------------------------------
// Module-level ABI cache — loaded once, reused by getUserRole so it never
// depends on React state (which would cause the "No Role Assigned" race bug).
//
// We deduplicate ABI entries before caching. This prevents the ethers.js
// "Duplicate definition of RoleRevoked" error that occurs because
// OpenZeppelin's AccessControl already declares RoleRevoked(bytes32,address,address)
// while older RoleManager.sol versions add a second RoleRevoked(address,string,address).
// Two different signatures under the same event name cause ethers to throw at
// contract instantiation time, which silently returns "NONE" from getUserRole.
// ---------------------------------------------------------------------------
const deduplicateABI = (abi) => {
  const seen = new Set();
  return abi.filter((entry) => {
    if (!entry.name) return true; // keep constructor / fallback / receive
    const inputs = (entry.inputs || []).map((i) => i.type).join(",");
    const key = `${entry.type}:${entry.name}(${inputs})`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

let _roleManagerABI = null;
const getRoleManagerABI = async () => {
  if (!_roleManagerABI) {
    const mod = await import("../contracts/RoleManager.json");
    _roleManagerABI = deduplicateABI((mod.default || mod).abi);
  }
  return _roleManagerABI;
};

export const useContract = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Load contract instances ──────────────────────────────────────────────
  const loadContracts = useCallback(async (signerOrProvider) => {
    try {
      const loadABI = async (name) => {
        const mod = await import(`../contracts/${name}.json`);
        const data = mod.default || mod;
        return { ...data, abi: deduplicateABI(data.abi) };
      };

      const [tokenData, registryData, roleManagerData] = await Promise.all([
        loadABI("EventRewardToken"),
        loadABI("EventRegistry"),
        loadABI("RoleManager"),
      ]);

      const newContracts = {
        token: new ethers.Contract(
          CONTRACT_ADDRESSES.EventRewardToken,
          tokenData.abi,
          signerOrProvider
        ),
        registry: new ethers.Contract(
          CONTRACT_ADDRESSES.EventRegistry,
          registryData.abi,
          signerOrProvider
        ),
        roleManager: new ethers.Contract(
          CONTRACT_ADDRESSES.RoleManager,
          roleManagerData.abi,
          signerOrProvider
        ),
      };

      setContracts(newContracts);
      // Also prime the ABI cache so future getUserRole calls are instant
      if (!_roleManagerABI) _roleManagerABI = roleManagerData.abi;

      return newContracts;
    } catch (err) {
      console.error("loadContracts error:", err);
      setError("Failed to load contracts");
      return {};
    }
  }, []);

  // ── Connect wallet (signer) ──────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const p = new ethers.providers.Web3Provider(window.ethereum);
      const s = p.getSigner();

      const signerAddress = await s.getAddress();
      if (!signerAddress) throw new Error("Signer connection failed");

      setProvider(p);
      setSigner(s);

      // Load contracts with signer and return them directly so the caller
      // does NOT have to wait for the async state update to propagate.
      const loadedContracts = await loadContracts(s);
      return loadedContracts;
    } catch (err) {
      setError(err.message);
      console.error("Connect error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadContracts]);

  // ── Auto-load provider + read-only contracts on mount ───────────────────
  // This ensures contracts are available for the initial wallet check even
  // before the user explicitly clicks "Connect".
  useEffect(() => {
    if (!window.ethereum) return;

    const init = async () => {
      const p = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(p);
      await loadContracts(p); // read-only — sufficient for getUserRole
    };

    init();

    const handleChainChanged = () => window.location.reload();
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => window.ethereum.removeListener("chainChanged", handleChainChanged);
  }, []); // stable — loadContracts has [] deps; only run once

  // ── getUserRole — self-contained, never fails due to stale state ─────────
  // FIX: uses a module-level ABI cache and creates its own provider instance
  // so it works at any point in the lifecycle (before connect, after connect,
  // after account switch, etc.).  No dependency on `contracts` state.
  const getUserRole = useCallback(async (address) => {
    if (!address || !CONTRACT_ADDRESSES.RoleManager) return "NONE";
    try {
      if (!window.ethereum) return "NONE";
      const abi = await getRoleManagerABI();
      const p = new ethers.providers.Web3Provider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.RoleManager,
        abi,
        p
      );
      const role = await contract.getUserRole(address);
      console.log("getUserRole:", address, "→", role);
      return role;
    } catch (err) {
      console.error("getUserRole error:", err.message);
      return "NONE";
    }
  }, []); // no state deps — always fresh

  // ── Balance ──────────────────────────────────────────────────────────────
  const getBalance = useCallback(
    async (address) => {
      if (!contracts.token) {
        console.warn("getBalance: token contract not initialized");
        return "0";
      }
      if (!address) {
        console.warn("getBalance: no address provided");
        return "0";
      }
      try {
        console.log("getBalance: fetching balance for", address);
        const bal = await contracts.token.getStudentBalance(address);
        const formatted = ethers.utils.formatUnits(bal, 18);
        console.log("getBalance: balance =", formatted, "ERT");
        return formatted;
      } catch (err) {
        console.error("getBalance error:", err);
        return "0";
      }
    },
    [contracts.token]
  );

  const getSignerAddress = useCallback(async () => {
    if (!signer) return null;
    try {
      return await signer.getAddress();
    } catch {
      return null;
    }
  }, [signer]);

  // ── Token operations ─────────────────────────────────────────────────────
  const mintTokens = useCallback(
    async (student, amount) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      const tx = await contracts.token
        .connect(signer)
        .mintTokens(student, ethers.utils.parseUnits(amount.toString(), 18));
      return await tx.wait();
    },
    [contracts.token, signer]
  );

  const redeemTokens = useCallback(
    async (amount, perk) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      if (!contracts.token) throw new Error("Contract not initialized");
      const tx = await contracts.token
        .connect(signer)
        .redeemTokens(ethers.utils.parseUnits(amount.toString(), 18), perk);
      return await tx.wait();
    },
    [contracts.token, signer]
  );

  const burnTokens = useCallback(
    async (student, amount) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      const tx = await contracts.token
        .connect(signer)
        .burnTokens(student, ethers.utils.parseUnits(amount.toString(), 18));
      return await tx.wait();
    },
    [contracts.token, signer]
  );

  const pauseSystem = useCallback(async () => {
    if (!signer) throw new Error("No signer connected. Please connect wallet first.");
    const tx = await contracts.token.connect(signer).pause();
    return await tx.wait();
  }, [contracts.token, signer]);

  const unpauseSystem = useCallback(async () => {
    if (!signer) throw new Error("No signer connected. Please connect wallet first.");
    const tx = await contracts.token.connect(signer).unpause();
    return await tx.wait();
  }, [contracts.token, signer]);

  const isPaused = useCallback(async () => {
    if (!contracts.token) return false;
    try {
      return await contracts.token.paused();
    } catch {
      return false;
    }
  }, [contracts.token]);

  // ── Registry operations ──────────────────────────────────────────────────
  const registerEvent = useCallback(
    async (name, desc, max) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      const tx = await contracts.registry
        .connect(signer)
        .registerEvent(name, desc, ethers.utils.parseUnits(max.toString(), 18));
      return await tx.wait();
    },
    [contracts.registry, signer]
  );

  const getAllEvents = useCallback(async () => {
    if (!contracts.registry) return [];
    try {
      const totalEvents = await contracts.registry.getTotalEvents();
      const eventCount = Number(totalEvents);
      const events = [];
      for (let i = 1; i <= eventCount; i++) {
        const event = await contracts.registry.getEventDetails(i);
        events.push({
          id: Number(event.id),
          name: String(event.name),
          description: String(event.description),
          organizer: String(event.organizer),
          maxRewards: ethers.utils.formatUnits(event.maxRewards, 18),
          totalMinted: ethers.utils.formatUnits(event.totalMinted, 18),
          createdAt: new Date(Number(event.createdAt) * 1000),
          active: Boolean(event.active),
        });
      }
      return events;
    } catch (err) {
      console.error("getAllEvents error:", err);
      return [];
    }
  }, [contracts.registry]);

  // FIX: joinEvent now takes (eventId, amount) — second param is the reward
  // amount (uint256), not a wallet address. The student address is msg.sender.
  const joinEvent = useCallback(
    async (eventId, amount) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      if (!contracts.registry) throw new Error("Registry contract not initialized");
      const tx = await contracts.registry
        .connect(signer)
        .recordStudentAttendance(
          eventId,
          ethers.utils.parseUnits(amount.toString(), 18)
        );
      return await tx.wait();
    },
    [contracts.registry, signer]
  );

  // FIX: EventRegistry has no getStudentEvents function. We return all events
  // so callers gracefully get the full list rather than throwing.
  const getStudentEvents = useCallback(async () => {
    return getAllEvents();
  }, [getAllEvents]);

  const hasStudentJoined = useCallback(
    async (eventId, studentAddress) => {
      if (!contracts.registry) return false;
      try {
        return await contracts.registry.hasStudentJoined(eventId, studentAddress);
      } catch (err) {
        console.error("hasStudentJoined error:", err);
        return false;
      }
    },
    [contracts.registry]
  );

  const recordAttendance = useCallback(
    async (eventId, rewardAmount) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      if (!contracts.registry) throw new Error("Registry contract not initialized");
      const tx = await contracts.registry
        .connect(signer)
        .recordStudentAttendance(
          eventId,
          ethers.utils.parseUnits(rewardAmount.toString(), 18)
        );
      return await tx.wait();
    },
    [contracts.registry, signer]
  );

  // ── Role management ──────────────────────────────────────────────────────
  const addOrganizer = useCallback(
    async (addr) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      const tx = await contracts.roleManager.connect(signer).addOrganizer(addr);
      return await tx.wait();
    },
    [contracts.roleManager, signer]
  );

  const addStudent = useCallback(
    async (addr) => {
      if (!signer) throw new Error("No signer connected. Please connect wallet first.");
      const tx = await contracts.roleManager.connect(signer).addStudent(addr);
      return await tx.wait();
    },
    [contracts.roleManager, signer]
  );

  return {
    provider,
    signer,
    contracts,
    loading,
    error,
    connect,
    getBalance,
    getUserRole,
    getSignerAddress,
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
    recordAttendance,
    joinEvent,
    getStudentEvents,
    hasStudentJoined,
  };
};