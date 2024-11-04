const { expect } = require("chai")
const { ethers } = require("hardhat")

const ERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')
const ISwapRouter = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json')

describe("Sniper Trade", () => {
  let owner
  let sniperTrade
  let usdc, weth
  const USDC_TOKEN = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
  const WETH_TOKEN = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

  beforeEach(async () => {
    [owner] = await ethers.getSigners()

    sniperTrade = await hre.ethers.deployContract("SniperTrade")
    await sniperTrade.waitForDeployment()

    // Setup ERC20 (USDC) contract...
    usdc = new ethers.Contract(USDC_TOKEN, ERC20.abi, owner)
    weth = new ethers.Contract(WETH_TOKEN, ERC20.abi, owner)
  })

  describe("Deployment", () => {
    it("Sets the owner", async () => {
      expect(await sniperTrade.owner()).to.equal(await owner.getAddress())
    })
  })

  describe('Impersonating an account to acquire USDC', () => {
    it('Sends USDC to deployer', async () => {
      const usdcBalanceBefore = await usdc.connect(owner).balanceOf(owner.address)

      // Account to impersonate
      const UNLOCKED_ACCOUNT = "0x4700192F8a4A00f009d87A515ff2d13E5cAb8364"

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT],
      })

      const signer = await hre.ethers.getSigner(UNLOCKED_ACCOUNT)

      // Transfer USDC to owner of LeveragedYieldFarm
      await (await usdc.connect(signer).transfer(owner.address, ethers.parseUnits('10000', 6))).wait()

      const usdcBalanceAfter = await usdc.balanceOf(owner.address)
      expect(usdcBalanceAfter).to.be.above(usdcBalanceBefore)
    })
  })

  describe("Trade tokens", () => {
    const AMOUNT = hre.ethers.parseUnits('990', 6)

    beforeEach(async () => {
      await (await usdc.connect(owner).transfer(
        await sniperTrade.getAddress(),
        ethers.parseUnits('1000', 6)
      )).wait()
    })

    it("Swap USDC to WETH ", async () => {
      const usdcBalanceBefore = await usdc.connect(owner).balanceOf(sniperTrade.getAddress())

      let transaction = await sniperTrade.connect(owner).buyToken(UNISWAP_V3_ROUTER, USDC_TOKEN, AMOUNT, WETH_TOKEN, 500)
      await transaction.wait()

      const usdcBalanceAfter = await usdc.balanceOf(sniperTrade.getAddress())
      expect(usdcBalanceAfter).to.be.below(usdcBalanceBefore)
    })

    it("Swap USDC to WETH and the inverse is failing", async () => {
      let transaction = await sniperTrade.connect(owner).buyToken(UNISWAP_V3_ROUTER, USDC_TOKEN, AMOUNT, WETH_TOKEN, 500)
      await transaction.wait()

      await expect(sniperTrade.connect(owner).sellToken(UNISWAP_V3_ROUTER, WETH_TOKEN, USDC_TOKEN, 500)).to.be.reverted
    })
  })
})
