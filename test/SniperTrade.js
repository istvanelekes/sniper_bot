const { expect } = require("chai")
const { ethers } = require("hardhat")

const ERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')
const ISwapRouter = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json')

describe("Sniper Trade", () => {
  let owner, account
  let sniperTrade, router
  let token0, token1, weth
  const TOKEN0 = "0x7997349fa5A0A79085778242DBe1fB9D8F5C475A"
  const TOKEN1 = "0x5ff0d2De4Cd862149c6672C99B7Edf3B092667A3" // SPX
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"

  beforeEach(async () => {
    const provider = await ethers.getDefaultProvider();
    const accounts = await ethers.getSigners()
    owner = accounts[0]
    account = accounts[1]

    sniperTrade = await hre.ethers.deployContract("SniperTrade")
    await sniperTrade.waitForDeployment()

    // Setup ERC20 (USDC) contract...
    token0 = new ethers.Contract(TOKEN0, ERC20.abi, owner)
    token1 = new ethers.Contract(TOKEN1, ERC20.abi, owner)
    weth = new ethers.Contract(WETH, ERC20.abi, owner)

    router = new ethers.Contract(UNISWAP_V3_ROUTER, ISwapRouter.abi, provider)
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
      const UNLOCKED_ACCOUNT = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

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

    it("Swap Token0 to Token1 ", async () => {

      const balanceBefore = await weth.connect(owner).balanceOf(sniperTrade.getAddress())

      const routerPath = await router.getAddress()

      console.log(routerPath)

      let transaction = await sniperTrade.connect(owner).buyToken(routerPath, weth, AMOUNT, token1, 500)
      await transaction.wait()

      const balanceAfter = await weth.balanceOf(sniperTrade.getAddress())
      expect(balanceAfter).to.be.below(balanceBefore)
    })

    it("Swap USDC to WETH and reverse", async () => {
      let transaction = await sniperTrade.connect(owner).buyToken(UNISWAP_V3_ROUTER, weth, AMOUNT, token1, 500)
      await transaction.wait()

      transaction = await sniperTrade.connect(owner).sellToken(UNISWAP_V3_ROUTER, token1, weth, 500)
      await transaction.wait()
    })
  })

  describe("Withdraw tokens", () => {
    describe('Success', () => {

      beforeEach(async () => {
        await (await weth.connect(owner).transfer(
          await sniperTrade.getAddress(),
          ethers.parseEther('40')
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
