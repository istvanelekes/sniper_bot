require("dotenv").config()
require('./helpers/server')

const chalk = require("chalk")
const axios = require('axios');
const moment = require('moment');
const ethers = require("ethers");

const { getTokenAndContract, getPoolContract, calculatePrice } = require('./helpers/helpers')
const { provider, signer, uniswapV2, uniswapV3, sniperTrade } = require('./helpers/initialization')
const { fetchSecurityInfo, checkSecurity, checkLpHolders, sleep } = require('./helpers/tokenSecurity')

// Use this functions for testing
const { loadAllPools, loadAllSwaps } = require('./helpers/testing')

const config = require('./config.json')
const SNIPER_TRADE_ADDRESS = config.PROJECT_SETTINGS.SNIPER_TRADE_ADDRESS
const PRICE_UPPER_LIMIT = config.PROJECT_SETTINGS.PRICE_UPPER_LIMIT
const PRICE_LOWER_LIMIT = config.PROJECT_SETTINGS.PRICE_LOWER_LIMIT
const WETH_AMOUNT = config.PROJECT_SETTINGS.WETH_AMOUNT
const WETH_AMOUNT_HALF = config.PROJECT_SETTINGS.WETH_AMOUNT_HALF
const QUEUE_SIZE = config.PROJECT_SETTINGS.QUEUE_SIZE
const FUNDINGS = Object.values(config.FUNDINGS)

const RouterV = {
  V2: 0,
  V3: 1
}

const tokenMap = new Map()
const tokenTimerMap = new Map()

const main = async () => {

  // UniswapV2 new pair listener
  // uniswapV2.factory.on('PairCreated', (token0, token1, pair, index) => eventHandler(RouterV.V2, token0, token1, pair, 0))

  // UniswapV3 new pool listener
  uniswapV3.factory.on('PoolCreated', (token0, token1, fee, tickSpacing, pool) => eventHandler(RouterV.V3, token0, token1, pool, fee))
}

const eventHandler = async (_routerV, _token0, _token1, _pool, _fee) => {

  console.log(chalk.blue(`Pool V${_routerV + 2} created with ${_token0} & ${_token1} at ${_pool} \n`))

  // if (tokenMap.size > QUEUE_SIZE) {
  //   console.log(chalk.bgRed("Token queue reached limit...\n"))
  //   return
  // }

  let tokenWeth, tokenNew

  if (FUNDINGS.includes(_token0)) {
    tokenWeth = _token0
    tokenNew = _token1
  } else if (FUNDINGS.includes(_token1)) {
    tokenWeth = _token1
    tokenNew = _token0
  } else {
    return
  }

  watchPoolSwaps(_routerV, _pool, _fee, tokenWeth, tokenNew)
}

/**
 * This function performs the token exchange on Uniswap by calling the 
 * SniperTrade contract functions.
 * @param _routerV Uniswap Router version(ex. V2, V3)
 * @param _tokenIn will be sold
 * @param _tokenOut will be bought
 * @param _amount 0 means we will sold all the balance of _tokenIn, otherwise a specific amount will be sold
 * @param _fee trading fee
 * @param _retry index of buy recalls if error occured
 */
async function buyToken(_routerV, _tokenIn, _tokenOut, _amount, _fee, _retry) {
  if (!config.PROJECT_SETTINGS.isDeployed) {
    console.log(chalk.red(`Contract is not deployed... \n`))
    return
  }

  console.log(chalk.green(`${_retry + 1}. Attempt...`))

  try {
    const transaction = await sniperTrade.connect(signer).buyToken(
      _routerV,
      _tokenIn,
      _amount,
      _tokenOut,
      _fee
    )
    await transaction.wait()

    console.log(chalk.yellow("---------------------------------------------------------"))
    console.log(chalk.yellow(`Sell token on V${_routerV + 2}, address: ${_tokenOut}`))
    console.log(chalk.yellow("---------------------------------------------------------\n"))
  } catch (error) {
    console.log(chalk.red(`Error on buy token: ${error} \n`))
    if (_retry < 3) {
      await buyToken(_routerV, _tokenIn, _tokenOut, _amount, _fee, _retry + 1)
    }
  }
}

async function sellToken(_routerV, _tokenIn, _tokenOut, _fee) {
  if (config.PROJECT_SETTINGS.isDeployed) {
    const transaction = await sniperTrade.connect(signer).sellToken(
      _routerV,
      _tokenIn,
      _tokenOut,
      _fee
    )
    await transaction.wait()

    console.log(chalk.green(`Sell Complete... \n`))
    return true
  }
  return false
}

const checkTokenSecurity = async (_routerV, _tokenIn, _tokenOut, _fee) => {
  const securityData = await fetchSecurityInfo(_tokenOut.address)
  const tokenKey = _tokenOut.address.toLowerCase()
  const securityInfo = securityData[tokenKey] 

  if (securityData && securityInfo) {
    console.log("Check Security info...")
    const tokenIsSecure = checkSecurity(securityInfo)

    if (tokenIsSecure) {
      console.log(chalk.green(`Try to buy ${_tokenOut.symbol} `))
      const amount = ethers.parseEther(WETH_AMOUNT)
      await buyToken(_routerV, _tokenIn.address, _tokenOut.address, amount, _fee, 0)
    } else {
      console.log(chalk.redBright(`Token is not secure: ${_tokenOut.address}\n`))
    }
  } else if (_routerV === RouterV.V3) {
    // without security check buy half amount
    console.log(chalk.bgGreen(`Try to buy without security check ${_tokenOut.symbol} `))
    const amount = ethers.parseEther(WETH_AMOUNT_HALF)
    await buyToken(_routerV, _tokenIn.address, _tokenOut.address, amount, _fee, 0)
  }
}

const watchPoolSwaps = async (_routerV, _poolAddress, _fee, _tokenIn, _tokenOut) => {
  const { tokenIn, tokenOut } = await getTokenAndContract(_tokenIn, _tokenOut, provider)

  const pool = await getPoolContract(_routerV, _poolAddress, _fee, provider)
  console.log(chalk.blue(`UniswapV${_routerV + 2} Pool Address: ${await pool.contract.getAddress()}`))
  console.log(chalk.blue(`Using ${tokenIn.symbol}/${tokenOut.symbol}\n`))

  tokenMap.set(_tokenOut, 1)

  pool.contract.on('Swap', () => poolSwapsHandler(_routerV, pool, tokenIn, tokenOut))
}

const poolSwapsHandler = async (_routerV, _pool, _tokenIn, _tokenOut) => {

  if (!tokenMap.has(_tokenOut.address)) {
    return 
  }

  const swapCount = tokenMap.get(_tokenOut.address)
  console.log(`${swapCount}. Swap event: ${_tokenIn.symbol}/${_tokenOut.symbol}`)

  // waiting max 10 seconds between swaps
  let swapDelaySec = 10
  const expireIn = tokenTimerMap.get(_tokenOut.address)

  switch (swapCount) {
    case 1:
      tokenMap.set(_tokenOut.address, swapCount + 1)
      tokenTimerMap.set(_tokenOut.address, moment().add(swapDelaySec, 'seconds'))
      break;
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      if (moment().isAfter(expireIn)) {
        let diff = moment().diff(expireIn, 'seconds') 
        console.log(chalk.redBright(`Token ${_tokenOut.symbol} expired by ${diff} seconds`))

        tokenMap.delete(_tokenOut.address)
        tokenTimerMap.delete(_tokenOut.address)
        _pool.contract.removeAllListeners()
      } else {
        tokenMap.set(_tokenOut.address, swapCount + 1)
        tokenTimerMap.set(_tokenOut.address, moment().add(swapDelaySec, 'seconds'))
      }

      break;
    default:
      tokenMap.delete(_tokenOut.address)
      tokenTimerMap.delete(_tokenOut.address)
      if (moment().isBefore(expireIn)) {
        await checkTokenSecurity(_routerV, _tokenIn, _tokenOut, _pool.fee)
      }
      _pool.contract.removeAllListeners()
  }
}

main()
