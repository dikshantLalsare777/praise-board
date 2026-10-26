const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PraiseBoard", function () {
  async function deployBoard() {
    const [owner, alice, bob, stranger] = await ethers.getSigners();
    const board = await (await ethers.getContractFactory("PraiseBoard")).deploy();
    return { board, owner, alice, bob, stranger };
  }

  it("records a valid tip and emits its event", async function () {
    const { board, alice } = await deployBoard();
    const amount = ethers.parseEther("0.02");
    const receipt = await board.connect(alice).tip("Great project!", { value: amount });
    const block = await ethers.provider.getBlock((await receipt.wait()).blockNumber);
    const tip = await board.getTip(0);

    expect(tip.supporter).to.equal(alice.address);
    expect(tip.amount).to.equal(amount);
    expect(tip.note).to.equal("Great project!");
    expect(tip.timestamp).to.equal(BigInt(block.timestamp));
    expect(await board.getTotalTipCount()).to.equal(1n);
    expect(await board.totalAmountReceived()).to.equal(amount);
    await expect(receipt)
      .to.emit(board, "TipReceived")
      .withArgs(alice.address, amount, "Great project!", BigInt(block.timestamp));
  });

  it("rejects empty, whitespace-only, and over-280-byte notes", async function () {
    const { board, alice } = await deployBoard();
    await expect(board.connect(alice).tip("", { value: 1n })).to.be.revertedWithCustomError(board, "EmptyNote");
    await expect(board.connect(alice).tip("   ", { value: 1n })).to.be.revertedWithCustomError(board, "EmptyNote");
    await expect(board.connect(alice).tip("a".repeat(281), { value: 1n }))
      .to.be.revertedWithCustomError(board, "NoteTooLong").withArgs(281n);
  });

  it("rejects zero-value tips", async function () {
    const { board, alice } = await deployBoard();
    await expect(board.connect(alice).tip("A note"))
      .to.be.revertedWithCustomError(board, "ZeroTip");
  });

  it("tracks multiple supporters and cumulative totals", async function () {
    const { board, alice, bob } = await deployBoard();
    await board.connect(alice).tip("First", { value: 10n });
    await board.connect(bob).tip("Second", { value: 20n });

    expect(await board.getTotalTipCount()).to.equal(2n);
    expect(await board.totalAmountReceived()).to.equal(30n);
    expect((await board.getTip(0)).supporter).to.equal(alice.address);
    expect((await board.getTip(1)).supporter).to.equal(bob.address);
  });

  it("allows only the owner to withdraw accumulated funds", async function () {
    const { board, owner, alice, stranger } = await deployBoard();
    await board.connect(alice).tip("Thanks", { value: 1000n });
    await expect(board.connect(stranger).withdraw())
      .to.be.revertedWithCustomError(board, "NotOwner");

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await board.connect(owner).withdraw();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    expect(await ethers.provider.getBalance(owner.address)).to.equal(balanceBefore + 1000n - gasCost);
    expect(await ethers.provider.getBalance(await board.getAddress())).to.equal(0n);
    await expect(board.connect(owner).withdraw())
      .to.be.revertedWithCustomError(board, "NothingToWithdraw");
  });
});
