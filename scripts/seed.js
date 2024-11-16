// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const config = require("../config.json")
const ERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')

const tokens = (n) => {
    return ethers.parseUnits(n.toString(), 'ether')
}

async function main() {
    // Fetch accounts
    console.log(`Fetching accounts \n`)
    const accounts = await ethers.getSigners()
    const deployer = accounts[0]

    console.log(`Fetching token and transferring to accounts... \n`)

    const sniperTrade = await ethers.getContractAt('SniperTrade', config.PROJECT_SETTINGS.SNIPER_TRADE_ADDRESS)
    const sniperTradeAddress = await sniperTrade.getAddress()
    console.log(`SniperTrade contract fetched: ${sniperTradeAddress}\n`)

    // Fetch WETH token
    const weth = new ethers.Contract(config.FUNDINGS.WETH, ERC20.abi, deployer)
    console.log(`WETH token fetched: ${await weth.getAddress()}\n`)
  
    ////////////////////////////////////////////////////
    // Send Tokens to SniperTrade
    //

    let transaction

    console.log(`Impersonate account... \n`)

    // Account to impersonate
    const UNLOCKED_ACCOUNT = "0x74B2A56432b14E182597A9cb31e2Db39dFF74B2C"

    await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [UNLOCKED_ACCOUNT],
    })

    const signer = await hre.ethers.getSigner(UNLOCKED_ACCOUNT)

    console.log(`Fund WETH... \n`)

    // Transfer WETH to owner of Sniper Trade
    await (await weth.connect(signer).transfer(deployer.address, ethers.parseEther('100'))).wait()

    // Send weth token to contract
    transaction = await weth.connect(deployer).transfer(sniperTradeAddress, ethers.parseEther('90'))
    await transaction.wait()

    // console.log(`Fund USDT... \n`)

    // // Send usdt token to contract
    // transaction = await usdt.connect(deployer).transfer(sniperTradeAddress, tokens(100))
    // await transaction.wait()

    console.log(`Finished. \n`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
