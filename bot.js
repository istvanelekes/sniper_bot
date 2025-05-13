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
const WETH_AMOUNT_NO_CHECK = config.PROJECT_SETTINGS.WETH_AMOUNT_NO_CHECK
const QUEUE_SIZE = config.PROJECT_SETTINGS.QUEUE_SIZE
const FUNDINGS = Object.values(config.FUNDINGS)

const RouterV = {
  V2: 0,
  V3: 1
}

class Swap {
  constructor(count, frequency, expireIn) {
      this.count = count;
      this.frequency = frequency;
      this.expireIn = expireIn;
  }

  checkExpiration() {
    this.frequency = moment().isAfter(this.expireIn) ? 0 : this.frequency + 1
    this.count += 1
    this.expireIn = moment().add(Swap.frequencyExpiration, 'seconds')
  }

  static countLimit = 16
  static frequencyLimit = 6
  static frequencyExpiration = 8
}

const tokenSwapMap = new Map()

const main = async () => {

  // UniswapV2 new pair listener
  // uniswapV2.factory.on('PairCreated', (token0, token1, pair, index) => eventHandler(RouterV.V2, token0, token1, pair, 0))

  // UniswapV3 new pool listener
  uniswapV3.factory.on('PoolCreated', (token0, token1, fee, tickSpacing, pool) => eventHandler(RouterV.V3, token0, token1, pool, fee))
}

const eventHandler = async (_routerV, _token0, _token1, _pool, _fee) => {

  console.log(chalk.blue(`Pool V${_routerV + 2} created with ${_token0} & ${_token1} at ${_pool} \n`))

  // if (tokenSwapMap.size > QUEUE_SIZE) {
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
 * @param _pool pool object ex. address, fee
 * @param _retry index of buy recalls if error occured
 */
async function buyToken(_routerV, _tokenIn, _tokenOut, _amount, _pool, _retry) {
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
      _pool.fee
    )
    await transaction.wait()

    console.log(chalk.yellow("---------------------------------------------------------"))
    console.log(chalk.yellow(`Sell token on V${_routerV + 2}, address: ${_tokenOut}`))
    console.log(chalk.yellow(`Pool address: ${_pool.address}`))
    console.log(chalk.yellow("---------------------------------------------------------\n"))
  } catch (error) {
    console.log(chalk.red(`Error on buy token: ${error} \n`))
    if (_retry < 3) {
      await buyToken(_routerV, _tokenIn, _tokenOut, _amount, _pool, _retry + 1)
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

const checkTokenSecurity = async (_routerV, _tokenIn, _tokenOut, _pool) => {
  const securityData = await fetchSecurityInfo(_tokenOut.address)
  const tokenKey = _tokenOut.address.toLowerCase()
  const securityInfo = securityData[tokenKey] 

  if (securityData && securityInfo) {
    console.log("Check Security info...")
    const tokenIsSecure = checkSecurity(securityInfo)

    if (tokenIsSecure) {
      console.log(chalk.green(`Try to buy ${_tokenOut.symbol} `))
      const amount = ethers.parseEther(WETH_AMOUNT)
      await buyToken(_routerV, _tokenIn.address, _tokenOut.address, amount, _pool, 0)
    } else {
      console.log(chalk.redBright(`Token is not secure: ${_tokenOut.address}\n`))
    }
  } else if (_routerV === RouterV.V3) {
    // without security check buy half amount
    console.log(chalk.bgGreen(`Try to buy without security check ${_tokenOut.symbol} `))
    const amount = ethers.parseEther(WETH_AMOUNT_NO_CHECK)
    await buyToken(_routerV, _tokenIn.address, _tokenOut.address, amount, _pool, 0)
  }
}

const watchPoolSwaps = async (_routerV, _poolAddress, _fee, _tokenIn, _tokenOut) => {
  const { tokenIn, tokenOut } = await getTokenAndContract(_tokenIn, _tokenOut, provider)

  const pool = await getPoolContract(_routerV, _poolAddress, _fee, provider)
  console.log(chalk.blue(`UniswapV${_routerV + 2} Pool Address: ${await pool.contract.getAddress()}`))
  console.log(chalk.blue(`Using ${tokenIn.symbol}/${tokenOut.symbol}\n`))

  let swap = new Swap(0, 0, moment().add(5, 'hours'))
  tokenSwapMap.set(_tokenOut, swap)

  pool.contract.on('Swap', () => poolSwapsHandler(_routerV, pool, tokenIn, tokenOut))
}

const poolSwapsHandler = async (_routerV, _pool, _tokenIn, _tokenOut) => {

  if (!tokenSwapMap.has(_tokenOut.address)) {
    return 
  }

  let swap = tokenSwapMap.get(_tokenOut.address)
  const diff = moment().diff(swap.expireIn, 'seconds')
  console.log(`${swap.count + 1}. Swap event: ${_tokenIn.symbol}/${_tokenOut.symbol}`)

  swap.checkExpiration()

  if (swap.frequency === 0) {
    console.log(chalk.redBright(`Token ${_tokenOut.symbol} buy frequency stopped by ${diff} seconds`))
  }
  
  if (swap.frequency > Swap.frequencyLimit) {
    // Try to buy token, we reached the desired swap frequency
    tokenSwapMap.delete(_tokenOut.address)
    await checkTokenSecurity(_routerV, _tokenIn, _tokenOut, _pool)
    _pool.contract.removeAllListeners()
  } else if (swap.count > Swap.countLimit) {
    // Swap count reached limit, stop event listening
    tokenSwapMap.delete(_tokenOut.address)
    _pool.contract.removeAllListeners()
  } else {
    // Countinue listening swap events
    tokenSwapMap.set(_tokenOut.address, swap)
  }
}

main()
