const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Event Reward Token System", function () {
  let token, registry, roleManager;
  let admin, organizer, student, other;

  beforeEach(async function () {
    [admin, organizer, student, other] = await ethers.getSigners();

    // Deploy contracts
    const EventRewardToken = await ethers.getContractFactory("EventRewardToken");
    token = await EventRewardToken.deploy(admin.address);
    await token.deployed();

    const EventRegistry = await ethers.getContractFactory("EventRegistry");
    registry = await EventRegistry.deploy(admin.address);
    await registry.deployed();

    const RoleManager = await ethers.getContractFactory("RoleManager");
    roleManager = await RoleManager.deploy(admin.address);
    await roleManager.deployed();

    // Link contracts
    await roleManager.setContracts(token.address, registry.address);

    // Grant RoleManager admin rights
    const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero;
    const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));

    await token.grantRole(DEFAULT_ADMIN_ROLE, roleManager.address);
    await registry.grantRole(DEFAULT_ADMIN_ROLE, roleManager.address);
    await token.grantRole(ADMIN_ROLE, roleManager.address);
    await registry.grantRole(ADMIN_ROLE, roleManager.address);

    // Add roles
    await roleManager.addOrganizer(organizer.address);
    await roleManager.addStudent(student.address);
  });

  // ===== EventRewardToken Tests =====
  describe("EventRewardToken", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await token.name()).to.equal("EventRewardToken");
      expect(await token.symbol()).to.equal("ERT");
    });

    it("Should assign ADMIN role to deployer", async function () {
      const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
      expect(await token.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should allow organizer to mint tokens to student", async function () {
      const amount = ethers.utils.parseEther("100");
      await expect(token.connect(organizer).mintTokens(student.address, amount))
        .to.emit(token, "TokenMinted")
        .withArgs(organizer.address, student.address, amount, await getTimestamp());

      expect(await token.balanceOf(student.address)).to.equal(amount);
    });

    it("Should NOT allow non-organizer to mint tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      await expect(
        token.connect(other).mintTokens(student.address, amount)
      ).to.be.revertedWith("Caller is not an organizer");
    });

    it("Should allow student to redeem tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      const redeemAmount = ethers.utils.parseEther("50");

      await token.connect(organizer).mintTokens(student.address, amount);

      await expect(token.connect(student).redeemTokens(redeemAmount, "Coffee Voucher"))
        .to.emit(token, "TokensRedeemed")
        .withArgs(student.address, redeemAmount, "Coffee Voucher", await getTimestamp());

      expect(await token.balanceOf(student.address)).to.equal(amount.sub(redeemAmount));
    });

    it("Should NOT allow student to redeem more than balance", async function () {
      const amount = ethers.utils.parseEther("50");
      const redeemAmount = ethers.utils.parseEther("100");

      await token.connect(organizer).mintTokens(student.address, amount);

      await expect(
        token.connect(student).redeemTokens(redeemAmount, "Coffee")
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should allow admin to burn tokens", async function () {
      const amount = ethers.utils.parseEther("100");
      await token.connect(organizer).mintTokens(student.address, amount);

      await expect(token.connect(admin).burnTokens(student.address, amount))
        .to.emit(token, "TokensBurned")
        .withArgs(admin.address, student.address, amount, await getTimestamp());

      expect(await token.balanceOf(student.address)).to.equal(0);
    });

    it("Should allow admin to pause and unpause", async function () {
      await token.connect(admin).pause();
      const amount = ethers.utils.parseEther("100");

      await expect(
        token.connect(organizer).mintTokens(student.address, amount)
      ).to.be.reverted;

      await token.connect(admin).unpause();
      await token.connect(organizer).mintTokens(student.address, amount);
      expect(await token.balanceOf(student.address)).to.equal(amount);
    });

    it("Should NOT allow non-admin to pause", async function () {
      await expect(token.connect(organizer).pause()).to.be.reverted;
    });

    it("Should track organizer rewards correctly", async function () {
      const amount = ethers.utils.parseEther("100");
      await token.connect(organizer).mintTokens(student.address, amount);
      expect(await token.getOrganizerRewards(organizer.address)).to.equal(amount);
    });

    it("Should return correct student balance", async function () {
      const amount = ethers.utils.parseEther("75");
      await token.connect(organizer).mintTokens(student.address, amount);
      expect(await token.getStudentBalance(student.address)).to.equal(amount);
    });

    it("Should return correct user roles", async function () {
      expect(await token.getUserRole(admin.address)).to.equal("ADMIN");
      expect(await token.getUserRole(organizer.address)).to.equal("ORGANIZER");
      expect(await token.getUserRole(student.address)).to.equal("STUDENT");
      expect(await token.getUserRole(other.address)).to.equal("NONE");
    });
  });

  // ===== EventRegistry Tests =====
  describe("EventRegistry", function () {
    it("Should allow organizer to register an event", async function () {
      await expect(
        registry.connect(organizer).registerEvent("Web3 Workshop", "Learn blockchain", 1000)
      ).to.emit(registry, "EventRegistered");

      expect(await registry.getTotalEvents()).to.equal(1);
    });

    it("Should NOT allow non-organizer to register an event", async function () {
      await expect(
        registry.connect(student).registerEvent("Test", "Test desc", 100)
      ).to.be.revertedWith("Caller is not an organizer");
    });

    it("Should return correct event details", async function () {
      await registry.connect(organizer).registerEvent("Web3 Workshop", "Learn blockchain", 1000);
      const event = await registry.getEventDetails(1);

      expect(event.name).to.equal("Web3 Workshop");
      expect(event.description).to.equal("Learn blockchain");
      expect(event.organizer).to.equal(organizer.address);
      expect(event.maxRewards).to.equal(1000);
      expect(event.active).to.be.true;
    });

    it("Should track organizer events", async function () {
      await registry.connect(organizer).registerEvent("Event 1", "Desc 1", 500);
      await registry.connect(organizer).registerEvent("Event 2", "Desc 2", 1000);

      const events = await registry.getOrganizerEvents(organizer.address);
      expect(events.length).to.equal(2);
    });

    it("Should deactivate event", async function () {
      await registry.connect(organizer).registerEvent("Workshop", "Desc", 500);
      await registry.connect(organizer).deactivateEvent(1);

      const event = await registry.getEventDetails(1);
      expect(event.active).to.be.false;
    });

    it("Should revert for invalid event ID", async function () {
      await expect(registry.getEventDetails(999)).to.be.revertedWith("Event does not exist");
    });
  });

  // ===== RoleManager Tests =====
  describe("RoleManager", function () {
    it("Should deploy with admin role", async function () {
      expect(await roleManager.isAdmin(admin.address)).to.be.true;
    });

    it("Should add organizer correctly", async function () {
      expect(await roleManager.isOrganizer(organizer.address)).to.be.true;
      expect(await token.getUserRole(organizer.address)).to.equal("ORGANIZER");
    });

    it("Should add student correctly", async function () {
      expect(await roleManager.isStudent(student.address)).to.be.true;
      expect(await token.getUserRole(student.address)).to.equal("STUDENT");
    });

    it("Should NOT allow non-admin to add organizer", async function () {
      await expect(
        roleManager.connect(organizer).addOrganizer(other.address)
      ).to.be.revertedWith("Caller is not an admin");
    });

    it("Should NOT allow non-admin to add student", async function () {
      await expect(
        roleManager.connect(student).addStudent(other.address)
      ).to.be.revertedWith("Caller is not an admin");
    });

    it("Should get user role correctly", async function () {
      expect(await roleManager.getUserRole(admin.address)).to.equal("ADMIN");
      expect(await roleManager.getUserRole(organizer.address)).to.equal("ORGANIZER");
      expect(await roleManager.getUserRole(student.address)).to.equal("STUDENT");
      expect(await roleManager.getUserRole(other.address)).to.equal("NONE");
    });

    it("Should revoke user role", async function () {
      await roleManager.revokeUserRole(student.address);
      expect(await roleManager.isStudent(student.address)).to.be.false;
    });
  });

  // ===== End-to-End Flow Tests =====
  describe("End-to-End Flow", function () {
    it("Should complete full reward and redemption cycle", async function () {
      // 1. Organizer creates event
      await registry.connect(organizer).registerEvent("Hackathon 2024", "Annual hackathon", 10000);

      // 2. Organizer mints tokens to student
      const rewardAmount = ethers.utils.parseEther("500");
      await token.connect(organizer).mintTokens(student.address, rewardAmount);

      // 3. Verify balance
      expect(await token.balanceOf(student.address)).to.equal(rewardAmount);

      // 4. Student redeems tokens
      const redeemAmount = ethers.utils.parseEther("200");
      await token.connect(student).redeemTokens(redeemAmount, "T-Shirt");

      // 5. Verify final balance
      expect(await token.balanceOf(student.address)).to.equal(rewardAmount.sub(redeemAmount));

      // 6. Verify redemptions tracked
      expect(await token.getStudentRedemptions(student.address)).to.equal(redeemAmount);
    });

    it("Should handle multiple students and organizers", async function () {
      const [, org2, stud2] = await ethers.getSigners();
      await roleManager.addOrganizer(org2.address);
      await roleManager.addStudent(stud2.address);

      await token.connect(organizer).mintTokens(student.address, ethers.utils.parseEther("100"));
      await token.connect(org2).mintTokens(stud2.address, ethers.utils.parseEther("200"));

      expect(await token.balanceOf(student.address)).to.equal(ethers.utils.parseEther("100"));
      expect(await token.balanceOf(stud2.address)).to.equal(ethers.utils.parseEther("200"));
    });
  });
});

async function getTimestamp() {
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
}
