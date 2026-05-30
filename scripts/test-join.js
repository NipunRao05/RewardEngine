const { ethers } = require("hardhat");

async function main() {
  const [admin, organizer, student] = await ethers.getSigners();

  console.log("Admin:", admin.address);
  console.log("Organizer:", organizer.address);
  console.log("Student:", student.address);

  // Get contract addresses from .env
  const TOKEN_ADDR = process.env.REACT_APP_TOKEN_ADDRESS || "0x09635F643e140090A9A8Dcd712eD6285858ceBef";
  const REGISTRY_ADDR = process.env.REACT_APP_REGISTRY_ADDRESS || "0xc5a5C42992dECbae36851359345FE25997F5C42d";
  const ROLE_MANAGER_ADDR = process.env.REACT_APP_ROLE_MANAGER_ADDRESS || "0x67d269191c92Caf3cD7723F116c85e6E9bf55933";

  // Load contracts
  const token = await ethers.getContractAt("EventRewardToken", TOKEN_ADDR);
  const registry = await ethers.getContractAt("EventRegistry", REGISTRY_ADDR);
  const roleManager = await ethers.getContractAt("RoleManager", ROLE_MANAGER_ADDR);

  console.log("\n=== Checking Roles ===");
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const hasMinterRole = await token.hasRole(MINTER_ROLE, REGISTRY_ADDR);
  console.log("Registry has MINTER_ROLE:", hasMinterRole);

  const isPaused = await token.paused();
  console.log("Token contract paused:", isPaused);

  const tokenContractInRegistry = await registry.tokenContract();
  console.log("Token contract in Registry:", tokenContractInRegistry);
  console.log("Matches TOKEN_ADDR:", tokenContractInRegistry.toLowerCase() === TOKEN_ADDR.toLowerCase());

  console.log("\n=== Adding Student Role ===");
  try {
    const tx = await roleManager.connect(admin).addStudent(student.address);
    await tx.wait();
    console.log("✅ Student role added to:", student.address);
  } catch (err) {
    console.log("⚠️ Student role already exists or error:", err.message);
  }

  console.log("\n=== Adding Organizer Role ===");
  try {
    const tx = await roleManager.connect(admin).addOrganizer(organizer.address);
    await tx.wait();
    console.log("✅ Organizer role added to:", organizer.address);
  } catch (err) {
    console.log("⚠️ Organizer role already exists or error:", err.message);
  }

  console.log("\n=== Creating Test Event ===");
  try {
    const tx = await registry.connect(organizer).registerEvent(
      "Test Event",
      "Testing student join",
      ethers.parseUnits("100", 18)
    );
    await tx.wait();
    console.log("✅ Event created");
  } catch (err) {
    console.log("⚠️ Event creation error:", err.message);
  }

  const totalEvents = await registry.getTotalEvents();
  console.log("Total events:", totalEvents.toString());

  console.log("\n=== Student Joining Event ===");
  try {
    const eventId = 1;
    const rewardAmount = ethers.parseUnits("10", 18);
    
    console.log("Student balance before:", ethers.formatUnits(await token.balanceOf(student.address), 18));
    
    const tx = await registry.connect(student).recordStudentAttendance(eventId, rewardAmount);
    const receipt = await tx.wait();
    console.log("✅ Student joined event! Gas used:", receipt.gasUsed.toString());
    
    const balanceAfter = await token.balanceOf(student.address);
    console.log("Student balance after:", ethers.formatUnits(balanceAfter, 18));
    
    const hasJoined = await registry.hasStudentJoined(eventId, student.address);
    console.log("Has student joined:", hasJoined);
  } catch (err) {
    console.error("❌ Join error:", err.message);
    if (err.data) {
      console.error("Error data:", err.data);
    }
  }
}

main().catch(console.error);
