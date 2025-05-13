const { expect } = require("chai")
const { ethers } = require("hardhat")

const IERC20 = require('@openzeppelin/contracts/build/contracts/IERC20.json')
const config = require('../config.json')

describe("Sniper Trade", () => {
  let owner, account
  let sniperTrade
  let token0, token1, weth
  const TOKEN0 = "0x1315D6D10E92Ec9E3B3f47335e5FFf9aa0DD996D"
  const TOKEN1 = "0x27975B4c21Bea0d85c38e036C389385470716A2A"
  const WETH = "0x4200000000000000000000000000000000000006"

  beforeEach(async () => {
    const provider = await ethers.getDefaultProvider();
    const accounts = await ethers.getSigners()
    owner = accounts[0]
    account = accounts[1]

    sniperTrade = await hre.ethers.deployContract("SniperTrade")
    await sniperTrade.waitForDeployment()

    // Setup ERC20 (USDC) contract...
    token0 = new ethers.Contract(TOKEN0, IERC20.abi, owner)
    token1 = new ethers.Contract(TOKEN1, IERC20.abi, owner)
    weth = new ethers.Contract(WETH, IERC20.abi, owner)
  })

  describe("Deployment", () => {
    it("Sets the owner", async () => {
      expect(await sniperTrade.owner()).to.equal(await owner.getAddress())
    })
  })

  describe('Impersonating an account to acquire USDC', () => {
    it('Sends WETH to deployer', async () => {
      const balanceBefore = await weth.connect(owner).balanceOf(owner.address)

      // Account to impersonate
      const UNLOCKED_ACCOUNT = "0x621e7c767004266c8109e83143ab0Da521B650d6"

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT],
      })

      const signer = await hre.ethers.getSigner(UNLOCKED_ACCOUNT)

      // Transfer weth to owner of Sniper Trade
      await (await weth.connect(signer).transfer(owner.address, ethers.parseEther('200'))).wait()

      const balanceAfter = await weth.balanceOf(owner.address)
      expect(balanceAfter).to.be.above(balanceBefore)
    })
  })

  describe("Trade tokens", () => {
    const AMOUNT = ethers.parseUnits('1', 18)

    beforeEach(async () => {
      await (await weth.connect(owner).transfer(
        await sniperTrade.getAddress(),
        ethers.parseEther('50')
      )).wait()
    })

    it("Swap on V2 Token0 to Token1 ", async () => {

      const balanceBefore = await weth.connect(owner).balanceOf(sniperTrade.getAddress())

      let transaction = await sniperTrade.connect(owner).buyToken(0, weth, AMOUNT, token1, 0)
      await transaction.wait()

      const balanceAfter = await weth.balanceOf(sniperTrade.getAddress())
      expect(balanceAfter).to.be.below(balanceBefore)
    })

    it("Swap on V3 Token0 to Token1 ", async () => {

      const balanceBefore = await weth.connect(owner).balanceOf(sniperTrade.getAddress())

      let transaction = await sniperTrade.connect(owner).buyToken(1, weth, AMOUNT, token1, 500)
      await transaction.wait()

      const balanceAfter = await weth.balanceOf(sniperTrade.getAddress())
      expect(balanceAfter).to.be.below(balanceBefore)
    })

    it("Swap on V2 USDC to WETH and reverse", async () => {
      let transaction = await sniperTrade.connect(owner).buyToken(0, weth, AMOUNT, token1, 0)
      await transaction.wait()

      transaction = await sniperTrade.connect(owner).sellToken(0, token1, weth, 0)
      await transaction.wait()
    })

    it("Swap on V3 USDC to WETH and reverse", async () => {
      let transaction = await sniperTrade.connect(owner).buyToken(1, weth, AMOUNT, token1, 500)
      await transaction.wait()

      transaction = await sniperTrade.connect(owner).sellToken(1, token1, weth, 500)
      await transaction.wait()
    })

    it("Buy Token amount than max balance to be reverted", async () => {
      const AMOUNT = ethers.parseUnits('91', 18)

      let transaction = sniperTrade.connect(owner).buyToken(0, weth, AMOUNT, token1, 500)

      await expect(transaction).to.be.reverted
    })

    it("Sell Token with zero balance to be reverted", async () => {

      let transaction = sniperTrade.connect(owner).sellToken(0, token1, weth, 500)

      await expect(transaction).to.be.reverted
    })
  })

  describe("Withdraw tokens", () => {
    describe('Success', () => {

      beforeEach(async () => {
        await (await weth.connect(owner).transfer(
          await sniperTrade.getAddress(),
          ethers.parseEther('1')
        )).wait()
      })
      
      it("withdraw weth", async () => {
        const balanceBefore = await weth.connect(owner).balanceOf(sniperTrade.getAddress())

        let transaction = await sniperTrade.connect(owner).withdrawToken(weth)
        await transaction.wait()

        const balanceAfter = await weth.balanceOf(sniperTrade.getAddress())
        expect(balanceAfter).to.be.below(balanceBefore)
      })

      it("withdraw weth percentage", async () => {
        const percentage = 17
        const balanceBefore = await weth.connect(owner).balanceOf(sniperTrade.getAddress())

        let transaction = await sniperTrade.connect(owner).withdrawTokenAtPercent(weth, percentage)
        await transaction.wait()

        const balanceAfter = await weth.balanceOf(sniperTrade.getAddress())
        const calculatePercent = balanceBefore * BigInt(percentage) / BigInt(100)

        expect(balanceAfter).to.equal(balanceBefore - calculatePercent)
      })

      it("withdraw ETH", async () => {
        const balanceBefore = await ethers.provider.getBalance(owner.address)

        let transaction = await sniperTrade.connect(owner).withdraw()
        await transaction.wait()

        const balanceAfter = await ethers.provider.getBalance(owner.address)
        expect(balanceAfter).to.be.below(balanceBefore)
      })
    })

    describe('Failure', () => {
      it('prevents non-owner from withdrawing', async () => {
        await expect(sniperTrade.connect(account).withdraw()).to.be.reverted
      })
    })
  })
})
