const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // Get the student account (Account #2)
  const [admin, organizer, student] = await ethers.getSigners();
  
  console.log("Testing with Student:", student.address);

  // Read contract addresses
  const envPath = path.join(__dirname, "../frontend/.env");
  const envContent = fs.readFileSync(envPath, "utf8");
  
  const TOKEN_ADDR = envContent.match(/REACT_APP_TOKEN_ADDRESS=(0x[a-fA-F0-9]+)/)?.[1];
  const REGISTRY_ADDR = envContent.match(/REACT_APP_REGISTRY_ADDRESS=(0x[a-fA-F0-9]+)/)?.[1];

  const token = await ethers.getContractAt("EventRewardToken", TOKEN_ADDR);
  const registry = await ethers.getContractAt("EventRegistry", REGISTRY_ADDR);

  console.log("\n=== Before Join ===");
  const balanceBefore = await token.balanceOf(student.address);
  console.log("Balance:", ethers.formatUnits(balanceBefore, 18), "ERT");
  
  const hasJoinedBefore = await registry.hasStudentJoined(1, student.address);
  console.log("Has joined event 1:", hasJoinedBefore);

  if (hasJoinedBefore) {
    console.log("\n⚠️  Student has already joined this event!");
    console.log("Current balance:", ethers.formatUnits(balanceBefore, 18), "ERT");
    return;
  }

  console.log("\n=== Joining Event ===");
  try {
    const tx = await registry.connect(student).recordStudentAttendance(
      1, // eventId
      ethers.parseUnits("10", 18) // 10 ERT reward
    );
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed! Gas used:", receipt.gasUsed.toString());

    console.log("\n=== After Join ===");
    const balanceAfter = await token.balanceOf(student.address);
    console.log("Balance:", ethers.formatUnits(balanceAfter, 18), "ERT");
    
    const hasJoinedAfter = await registry.hasStudentJoined(1, student.address);
    console.log("Has joined event 1:", hasJoinedAfter);

    const event = await registry.getEventDetails(1);
    console.log("\nEvent details:");
    console.log("  Total minted:", ethers.formatUnits(event.totalMinted, 18), "ERT");
    console.log("  Max rewards:", ethers.formatUnits(event.maxRewards, 18), "ERT");
    console.log("  Remaining:", ethers.formatUnits(event.maxRewards - event.totalMinted, 18), "ERT");
  } catch (err) {
    console.error("❌ Error:", err.message);
    if (err.data) {
      console.error("Error data:", err.data);
    }
  }
}

main().catch(console.error);
