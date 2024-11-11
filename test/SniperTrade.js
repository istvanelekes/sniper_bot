const { expect } = require("chai")
const { ethers } = require("hardhat")

const ERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')
const ISwapRouter = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json')

describe("Sniper Trade", () => {
  let owner
  let sniperTrade
  let token0, token1, usdc
  const TOKEN0 = "0x7997349fa5A0A79085778242DBe1fB9D8F5C475A"
  const TOKEN1 = "0xdAC17F958D2ee523a2206206994597C13D831ec7" // USDT
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

  beforeEach(async () => {
    const provider = await ethers.getDefaultProvider();
    [owner] = await ethers.getSigners()

    sniperTrade = await hre.ethers.deployContract("SniperTrade")
    await sniperTrade.waitForDeployment()

    // Setup ERC20 (USDC) contract...
    token0 = new ethers.Contract(TOKEN0, ERC20.abi, owner)
    token1 = new ethers.Contract(TOKEN1, ERC20.abi, owner)
    usdc = new ethers.Contract(USDC, ERC20.abi, owner)
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
      const UNLOCKED_ACCOUNT = "0x48EC5560bFD59b95859965cCE48cC244CFDF6b0c"

      await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [UNLOCKED_ACCOUNT],
      })

      const signer = await hre.ethers.getSigner(UNLOCKED_ACCOUNT)

      // Transfer USDC to owner of Sniper Trade
      await (await usdc.connect(signer).transfer(owner.address, ethers.parseUnits('10000', 6))).wait()

      const usdcBalanceAfter = await usdc.balanceOf(owner.address)
      expect(usdcBalanceAfter).to.be.above(usdcBalanceBefore)
    })
  })

  describe("Trade tokens", () => {
    const AMOUNT = ethers.parseUnits('1', 6)

    beforeEach(async () => {
      await (await usdc.connect(owner).transfer(
        await sniperTrade.getAddress(),
        ethers.parseUnits('1000', 6)
      )).wait()
    })

    it("Swap Token0 to Token1 ", async () => {

      const usdcBalanceBefore = await usdc.connect(owner).balanceOf(sniperTrade.getAddress())

      let transaction = await sniperTrade.connect(owner).buyToken(UNISWAP_V3_ROUTER, usdc, AMOUNT, token1, 500)
      await transaction.wait()

      const usdcBalanceAfter = await usdc.balanceOf(sniperTrade.getAddress())
      expect(usdcBalanceAfter).to.be.below(usdcBalanceBefore)
    })

    // it("Swap USDC to WETH and the inverse is failing", async () => {
    //   let transaction = await sniperTrade.connect(owner).buyToken(UNISWAP_V3_ROUTER, USDC_TOKEN, AMOUNT, WETH_TOKEN, 500)
    //   await transaction.wait()

    //   await expect(sniperTrade.connect(owner).sellToken(UNISWAP_V3_ROUTER, WETH_TOKEN, USDC_TOKEN, 500)).to.be.reverted
    // })
  })
})
