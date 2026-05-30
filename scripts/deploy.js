// const { ethers } = require("hardhat");
// const fs = require("fs");
// const path = require("path");

// async function main() {
//   const [deployer] = await ethers.getSigners();
//   console.log("Deploying contracts with account:", deployer.address);
//   console.log("Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");

//   // 1. Deploy EventRewardToken
//   console.log("\n📦 Deploying EventRewardToken...");
//   const EventRewardToken = await ethers.getContractFactory("EventRewardToken");
//   const token = await EventRewardToken.deploy(deployer.address);
//   await token.waitForDeployment();
//   console.log("✅ EventRewardToken deployed to:", token.address);

//   // 2. Deploy EventRegistry
//   console.log("\n📦 Deploying EventRegistry...");
//   const EventRegistry = await ethers.getContractFactory("EventRegistry");
//   const registry = await EventRegistry.deploy(deployer.address);
//   await registry.deployed();
//   console.log("✅ EventRegistry deployed to:", registry.address);

//   // 3. Deploy RoleManager
//   console.log("\n📦 Deploying RoleManager...");
//   const RoleManager = await ethers.getContractFactory("RoleManager");
//   const roleManager = await RoleManager.deploy(deployer.address);
//   await roleManager.deployed();
//   console.log("✅ RoleManager deployed to:", roleManager.address);

//   // 4. Link contracts in RoleManager
//   console.log("\n🔗 Linking contracts...");
//   const setTx = await roleManager.setContracts(token.address, registry.address);
//   await setTx.wait();
//   console.log("✅ Contracts linked in RoleManager");

//   // 5. Grant RoleManager admin rights on token and registry
//   const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
//   const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));

//   await (await token.grantRole(DEFAULT_ADMIN_ROLE, roleManager.address)).wait();
//   await (await registry.grantRole(DEFAULT_ADMIN_ROLE, roleManager.address)).wait();
//   await (await token.grantRole(ADMIN_ROLE, roleManager.address)).wait();
//   await (await registry.grantRole(ADMIN_ROLE, roleManager.address)).wait();
//   console.log("✅ RoleManager granted admin rights");

//   // 6. Save deployment addresses
//   const deploymentInfo = {
//     network: "localhost",
//     chainId: 31337,
//     deployer: deployer.address,
//     contracts: {
//       EventRewardToken: token.address,
//       EventRegistry: registry.address,
//       RoleManager: roleManager.address,
//     },
//     deployedAt: new Date().toISOString(),
//   };

//   const deploymentsDir = path.join(__dirname, "../deployments");
//   if (!fs.existsSync(deploymentsDir)) {
//     fs.mkdirSync(deploymentsDir, { recursive: true });
//   }

//   fs.writeFileSync(
//     path.join(deploymentsDir, "localhost.json"),
//     JSON.stringify(deploymentInfo, null, 2)
//   );

//   // 7. Copy ABIs to frontend and backend
//   await copyABIs(token.address, registry.address, roleManager.address);

//   console.log("\n🎉 Deployment complete!");
//   console.log("Deployment info saved to deployments/localhost.json");
//   console.log("\nContract Addresses:");
//   console.log("  EventRewardToken:", token.address);
//   console.log("  EventRegistry:   ", registry.address);
//   console.log("  RoleManager:     ", roleManager.address);
//   console.log("\nAdmin address:", deployer.address);
//   console.log("\nNext steps:");
//   console.log("  1. cd backend && npm start");
//   console.log("  2. cd frontend && npm start");
//   console.log("  3. Import deployer private key into MetaMask");
// }

// async function copyABIs(tokenAddr, registryAddr, roleManagerAddr) {
//   const artifactsBase = path.join(__dirname, "../artifacts/contracts");
//   const frontendContracts = path.join(__dirname, "../frontend/src/contracts");
//   const backendContracts = path.join(__dirname, "../backend/contracts");

//   [frontendContracts, backendContracts].forEach((dir) => {
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
//   });

//   const contracts = [
//     { name: "EventRewardToken", address: tokenAddr },
//     { name: "EventRegistry", address: registryAddr },
//     { name: "RoleManager", address: roleManagerAddr },
//   ];

//   for (const { name, address } of contracts) {
//     const artifactPath = path.join(artifactsBase, `${name}.sol/${name}.json`);
//     if (fs.existsSync(artifactPath)) {
//       const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
//       const exportData = {
//         address,
//         abi: artifact.abi,
//       };
//       const fileName = `${name}.json`;
//       fs.writeFileSync(path.join(frontendContracts, fileName), JSON.stringify(exportData, null, 2));
//       fs.writeFileSync(path.join(backendContracts, fileName), JSON.stringify(exportData, null, 2));
//       console.log(`✅ ABI copied: ${name}`);
//     }
//   }
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });


const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  // Deploy Token
  const EventRewardToken = await ethers.getContractFactory("EventRewardToken");
  const token = await EventRewardToken.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("✅ Token:", tokenAddr);

  // Deploy Registry
  const EventRegistry = await ethers.getContractFactory("EventRegistry");
  const registry = await EventRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("✅ Registry:", registryAddr);

  // Deploy RoleManager
  const RoleManager = await ethers.getContractFactory("RoleManager");
  const roleManager = await RoleManager.deploy(deployer.address);
  await roleManager.waitForDeployment();
  const roleManagerAddr = await roleManager.getAddress();
  console.log("✅ RoleManager:", roleManagerAddr);

  // Link contracts
  await (await roleManager.setContracts(tokenAddr, registryAddr)).wait();
  await (await registry.setTokenContract(tokenAddr)).wait();

  // Roles
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
  const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  await (await token.grantRole(DEFAULT_ADMIN_ROLE, roleManagerAddr)).wait();
  await (await registry.grantRole(DEFAULT_ADMIN_ROLE, roleManagerAddr)).wait();
  await (await token.grantRole(ADMIN_ROLE, roleManagerAddr)).wait();
  await (await registry.grantRole(ADMIN_ROLE, roleManagerAddr)).wait();
  
  // Grant MINTER_ROLE to EventRegistry so it can mint tokens when students join
  await (await token.grantRole(MINTER_ROLE, registryAddr)).wait();

  console.log("🎉 Deployment complete");

  console.log("\nAddresses:");
  console.log("TOKEN:", tokenAddr);
  console.log("REGISTRY:", registryAddr);
  console.log("ROLE:", roleManagerAddr);

  // Copy ABIs to frontend
  const artifactsBase = path.join(__dirname, "../artifacts/contracts");
  const frontendContracts = path.join(__dirname, "../frontend/src/contracts");

  if (!fs.existsSync(frontendContracts)) {
    fs.mkdirSync(frontendContracts, { recursive: true });
  }

  const contracts = [
    { name: "EventRewardToken", address: tokenAddr },
    { name: "EventRegistry", address: registryAddr },
    { name: "RoleManager", address: roleManagerAddr },
  ];

  console.log("\n📝 Copying ABIs...");
  for (const { name, address } of contracts) {
    const artifactPath = path.join(artifactsBase, `${name}.sol`, `${name}.json`);
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
      const exportData = {
        address,
        abi: artifact.abi,
      };
      const fileName = `${name}.json`;
      fs.writeFileSync(path.join(frontendContracts, fileName), JSON.stringify(exportData, null, 2));
      console.log(`  ✅ ${name}.json`);
    } else {
      console.log(`  ⚠️  ${name} artifact not found at ${artifactPath}`);
    }
  }

  // Save addresses to .env
  const envContent = `REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_TOKEN_ADDRESS=${tokenAddr}
REACT_APP_REGISTRY_ADDRESS=${registryAddr}
REACT_APP_ROLE_MANAGER_ADDRESS=${roleManagerAddr}
REACT_APP_CHAIN_ID=31337
`;

  const envPath = path.join(__dirname, "../frontend/.env");
  fs.writeFileSync(envPath, envContent);
  console.log("\n✅ Updated frontend/.env with contract addresses");
}

main().catch(console.error);