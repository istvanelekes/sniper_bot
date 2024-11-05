require("dotenv").config()
const ethers = require('ethers')

const config = require('../config.json')
const IUniswapV3Factory = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json')
const IQuoter = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/IQuoterV2.sol/IQuoterV2.json')
const ISwapRouter = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json')

let provider

if (config.PROJECT_SETTINGS.isLocal) {
  provider = new ethers.WebSocketProvider(`ws://127.0.0.1:8545/`)
} else {
  provider = new ethers.WebSocketProvider(`wss://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
}

// -- SETUP UNISWAP CONTRACTS -- //
const uniswap = {
  name: "Uniswap V3",
  factory: new ethers.Contract(config.UNISWAP.FACTORY_V3, IUniswapV3Factory.abi, provider),
  quoter: new ethers.Contract(config.UNISWAP.QUOTER_V3, IQuoter.abi, provider),
  router: new ethers.Contract(config.UNISWAP.ROUTER_V3, ISwapRouter.abi, provider)
}

const ISniperTrade = require('../artifacts/contracts/SniperTrade.sol/SniperTrade.json')
const sniperTrade = new ethers.Contract(config.PROJECT_SETTINGS.SNIPER_TRADE_ADDRESS, ISniperTrade.abi, provider)

module.exports = {
  provider,
  uniswap,
  sniperTrade
}