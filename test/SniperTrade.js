const { expect } = require("chai")

describe("Sniper Trade", () => {
  let owner
  let sniperTrade

  beforeEach(async () => {
    [owner] = await ethers.getSigners()

    sniperTrade = await hre.ethers.deployContract("SniperTrade")
    await sniperTrade.waitForDeployment()
  })

  describe("Deployment", () => {
    it("Sets the owner", async () => {
      expect(await sniperTrade.owner()).to.equal(await owner.getAddress())
    })
  })

  describe("Trading", () => {

    /**
     * Feel Free to customize and add in your own unit testing here.
     */

  })
})
