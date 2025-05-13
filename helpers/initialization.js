require("dotenv").config()
const ethers = require('ethers')

const config = require('../config.json')
const IUniswapV2Factory = require('@uniswap/v2-core/build/IUniswapV2Factory.json')
const IUniswapV3Factory = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json')
const ISwapRouter02 = require('@uniswap/swap-router-contracts/artifacts/contracts/interfaces/ISwapRouter02.sol/ISwapRouter02.json')

let provider
let signer

if (config.PROJECT_SETTINGS.isLocal) {
  provider = new ethers.WebSocketProvider(`ws://127.0.0.1:8545/`)
  signer = provider.getSigner()
} else {
  provider = new ethers.WebSocketProvider(`wss://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
  signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
}

// -- SETUP UNISWAP CONTRACTS -- //
const uniswapV2 = {
  name: "Uniswap V2",
  factory: new ethers.Contract(config.UNISWAP.FACTORY_V2, IUniswapV2Factory.abi, provider),
  router: new ethers.Contract(config.UNISWAP.ROUTER_V2, ISwapRouter02.abi, provider)
}

const uniswapV3 = {
  name: "Uniswap V3",
  factory: new ethers.Contract(config.UNISWAP.FACTORY_V3, IUniswapV3Factory.abi, provider),
  router: new ethers.Contract(config.UNISWAP.ROUTER_V3, ISwapRouter02.abi, provider)
}

const ISniperTrade = require('../artifacts/contracts/SniperTrade.sol/SniperTrade.json')
const sniperTrade = new ethers.Contract(config.PROJECT_SETTINGS.SNIPER_TRADE_ADDRESS, ISniperTrade.abi, provider)

module.exports = {
  provider,
  signer,
  uniswapV2,
  uniswapV3,
  sniperTrade
}