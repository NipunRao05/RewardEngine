const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Setting up demo environment...\n");

  const [admin, organizer, student1, student2] = await ethers.getSigners();

  // Read contract addresses from frontend .env
  const envPath = path.join(__dirname, "../frontend/.env");
  const envContent = fs.readFileSync(envPath, "utf8");
  
  const TOKEN_ADDR = envContent.match(/REACT_APP_TOKEN_ADDRESS=(0x[a-fA-F0-9]+)/)?.[1];
  const REGISTRY_ADDR = envContent.match(/REACT_APP_REGISTRY_ADDRESS=(0x[a-fA-F0-9]+)/)?.[1];
  const ROLE_MANAGER_ADDR = envContent.match(/REACT_APP_ROLE_MANAGER_ADDRESS=(0x[a-fA-F0-9]+)/)?.[1];

  if (!TOKEN_ADDR || !REGISTRY_ADDR || !ROLE_MANAGER_ADDR) {
    console.error("❌ Could not read contract addresses from frontend/.env");
    process.exit(1);
  }

  console.log("📋 Contract Addresses:");
  console.log("  Token:       ", TOKEN_ADDR);
  console.log("  Registry:    ", REGISTRY_ADDR);
  console.log("  RoleManager: ", ROLE_MANAGER_ADDR);
  console.log();

  // Load contracts
  const token = await ethers.getContractAt("EventRewardToken", TOKEN_ADDR);
  const registry = await ethers.getContractAt("EventRegistry", REGISTRY_ADDR);
  const roleManager = await ethers.getContractAt("RoleManager", ROLE_MANAGER_ADDR);

  console.log("👥 Test Accounts:");
  console.log("  Admin:     ", admin.address);
  console.log("  Organizer: ", organizer.address);
  console.log("  Student 1: ", student1.address);
  console.log("  Student 2: ", student2.address);
  console.log();

  // Add roles
  console.log("🔐 Assigning Roles...");
  
  try {
    await (await roleManager.connect(admin).addOrganizer(organizer.address)).wait();
    console.log("  ✅ Organizer role assigned to", organizer.address);
  } catch (err) {
    console.log("  ⚠️  Organizer already has role");
  }

  try {
    await (await roleManager.connect(admin).addStudent(student1.address)).wait();
    console.log("  ✅ Student role assigned to", student1.address);
  } catch (err) {
    console.log("  ⚠️  Student 1 already has role");
  }

  try {
    await (await roleManager.connect(admin).addStudent(student2.address)).wait();
    console.log("  ✅ Student role assigned to", student2.address);
  } catch (err) {
    console.log("  ⚠️  Student 2 already has role");
  }

  console.log();

  // Create events
  console.log("🎫 Creating Demo Events...");
  
  const events = [
    { name: "DevThon 2026", desc: "Annual hackathon for developers", rewards: "1000" },
    { name: "AI Workshop", desc: "Learn about machine learning and AI", rewards: "500" },
    { name: "Blockchain Summit", desc: "Explore the future of Web3", rewards: "750" },
  ];

  for (const event of events) {
    try {
      await (await registry.connect(organizer).registerEvent(
        event.name,
        event.desc,
        ethers.parseUnits(event.rewards, 18)
      )).wait();
      console.log(`  ✅ Created: ${event.name} (${event.rewards} ERT)`);
    } catch (err) {
      console.log(`  ⚠️  Event "${event.name}" may already exist`);
    }
  }

  console.log();

  // Show summary
  const totalEvents = await registry.getTotalEvents();
  console.log("📊 Summary:");
  console.log("  Total Events:", totalEvents.toString());
  console.log("  Token Paused:", await token.paused());
  
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  console.log("  Registry has MINTER_ROLE:", await token.hasRole(MINTER_ROLE, REGISTRY_ADDR));

  console.log();
  console.log("✅ Demo setup complete!");
  console.log();
  console.log("🎯 Next Steps:");
  console.log("  1. Open http://localhost:3000 in your browser");
  console.log("  2. Connect MetaMask with one of these accounts:");
  console.log("     - Admin:     ", admin.address);
  console.log("     - Organizer: ", organizer.address);
  console.log("     - Student:   ", student1.address);
  console.log("  3. Students can now join events and earn tokens!");
}

main().catch(console.error);
