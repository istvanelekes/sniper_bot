const ethers = require("ethers")
const Big = require('big.js')

const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json")
const IUniswapV3Pool = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')

async function getTokenAndContract(_token0Address, _token1Address, _provider) {
  const token0Contract = new ethers.Contract(_token0Address, IERC20.abi, _provider)
  const token1Contract = new ethers.Contract(_token1Address, IERC20.abi, _provider)

  const tokenIn = {
    contract: token0Contract,
    address: _token0Address,
    symbol: await token0Contract.symbol(),
    decimals: await token0Contract.decimals()
  }

  const tokenOut = {
    contract: token1Contract,
    address: _token1Address,
    symbol: await token1Contract.symbol(),
    decimals: await token1Contract.decimals()
  }

  return { tokenIn, tokenOut }
}

async function getPoolContract(_routerV, _poolAddress, _fee, _provider) {

  const poolABI = _routerV === 0 ? IUniswapV2Pair.abi : IUniswapV3Pool.abi
  const poolContract = new ethers.Contract(_poolAddress, poolABI, _provider)

  const pool = {
    contract: poolContract,
    address: _poolAddress,
    fee: _fee
  }
  return pool
}

async function getPairContract(_pairAddress, _provider) {
  const pairContract = new ethers.Contract(_pairAddress, IUniswapV2Pair.abi, _provider)

  const pair = {
    contract: pairContract,
    address: _pairAddress
  }
  return pair
}

async function calculatePrice(_pool, _token0, _token1) {
  // Understanding Uniswap V3 prices
  // --> https://blog.uniswap.org/uniswap-v3-math-primer

  // Get sqrtPriceX96...
  const [sqrtPriceX96] = await _pool.slot0()

  // Get decimalDifference if there is a difference...
  const decimalDifference = Number(Big(_token0.decimals - _token1.decimals).abs())
  const conversion = Big(10).pow(decimalDifference)

  // Calculate rate and price...
  const rate = Big((Big(sqrtPriceX96).div(Big(2 ** 96))) ** Big(2))
  const price = Big(rate).div(Big(conversion)).toString()

  if (price == 0) {
    return Big(rate).mul(Big(conversion)).toString()
  } else {
    return price
  }
}

module.exports = {
  getTokenAndContract,
  getPoolContract,
  calculatePrice
}