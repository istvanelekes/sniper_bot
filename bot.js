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
  uniswapV2.factory.on('PairCreated', (token0, token1, pair, index) => eventHandler(RouterV.V2, token0, token1, pair, 0))

  // UniswapV3 new pool listener
  uniswapV3.factory.on('PoolCreated', (token0, token1, fee, tickSpacing, pool) => eventHandler(RouterV.V3, token0, token1, pool, fee))

  console.log("Waiting for new pools...\n")
}

const eventHandler = async (_routerV, _token0, _token1, _pool, _fee) => {

  console.log(chalk.blue(`Pool V${_routerV + 2} created with ${_token0} & ${_token1} at ${_pool} \n`))

  if (tokenMap.size > QUEUE_SIZE) {
    console.log(chalk.bgRed("Token queue reached limit...\n"))
    return
  }

  let tokenWeth, tokenNew

  if (FUNDINGS.includes(_token0)) {
    tokenWeth = _token0
    tokenNew = _token1
  } else if (FUNDINGS.includes(_token1)) {
    tokenWeth = _token1
    tokenNew = _token0
  } else {
    console.log("Waiting for new pools...\n")
    return
  }

  const securityData = await fetchSecurityInfo(tokenNew)
  const tokenKey = tokenNew.toLowerCase()
  const securityInfo = securityData[tokenKey] 

  if (securityData && securityInfo) {
    console.log("Check Security info...")
    const tokenIsSecure = checkSecurity(securityInfo)

    if (tokenIsSecure) {
      const holders = await checkLpHolders(securityInfo, tokenNew)
      const amount = ethers.parseEther(WETH_AMOUNT)
      console.log(`LP holders: ${holders} \n`)

      watchPoolSwaps(_routerV, _pool, _fee, tokenWeth, tokenNew)

    } else {
      console.log(chalk.redBright(`Token is not secure: ${tokenNew}\n`))
    }
  }

  console.log("Waiting for new pools...\n")
}

/**
 * This function performs the token exchange on Uniswap by calling the 
 * SniperTrade contract functions.
 * @param _routerV Uniswap Router version(ex. V2, V3)
 * @param _tokenIn will be sold
 * @param _tokenOut will be bought
 * @param _amount 0 means we will sold all the balance of _tokenIn, otherwise a specific amount will be sold
 * @param _fee trading fee
 */
async function buyToken(_routerV, _tokenIn, _tokenOut, _amount, _fee) {
  if (!config.PROJECT_SETTINGS.isDeployed) {
    console.log(chalk.red(`Contract is not deployed... \n`))
    return
  }

  try {
    const transaction = await sniperTrade.connect(signer).buyToken(
      _routerV,
      _tokenIn,
      _amount,
      _tokenOut,
      _fee
    )
    await transaction.wait(0)
    console.log(chalk.green(`Buy Complete... \n`))
  } catch (error) {
    console.log(chalk.red(`Error on buy token: ${error} \n`))
  } finally {
    console.log(chalk.yellow("---------------------------------------------------------"))
    console.log(chalk.yellow(`Sell token on V${_routerV + 2}, address: ${_tokenOut}`))
    console.log(chalk.yellow("---------------------------------------------------------\n"))
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
    await transaction.wait(0)

    console.log(chalk.green(`Sell Complete... \n`))
    return true
  }
  return false
}


const watchPoolSwaps = async (_routerV, _poolAddress, _fee, _tokenIn, _tokenOut) => {
  const { tokenIn, tokenOut } = await getTokenAndContract(_tokenIn, _tokenOut, provider)

  const pool = await getPoolContract(_routerV, _poolAddress, _fee, provider)
  console.log(chalk.blue(`UniswapV${_routerV + 2} Pool Address: ${await pool.contract.getAddress()}`))
  console.log(chalk.blue(`Using ${tokenIn.symbol}/${tokenOut.symbol}\n`))

  tokenMap.set(_tokenOut, 1)
  tokenTimerMap.set(_tokenOut, moment().add(3, 'minutes'))

  pool.contract.on('Swap', () => poolSwapsHandler(_routerV, pool, tokenIn, tokenOut))
}

const poolSwapsHandler = async (_routerV, _pool, _tokenIn, _tokenOut) => {

  if (!tokenMap.has(_tokenOut.address)) {
    return 
  }

  const swapCount = tokenMap.get(_tokenOut.address)
  console.log(`${swapCount}. Swap event: ${_tokenIn.symbol}/${_tokenOut.symbol}`)

  const expireIn = tokenTimerMap.get(_tokenOut.address)
  if (moment().isAfter(expireIn)) {
    console.log(chalk.redBright(`Token ${_tokenOut.symbol} expired`))
    tokenMap.delete(_tokenOut.address)
    tokenTimerMap.delete(_tokenOut.address)

    return
  }

  if (swapCount > 5) {

    tokenMap.delete(_tokenOut.address)
    tokenTimerMap.delete(_tokenOut.address)

    console.log(chalk.green(`Try to buy ${_tokenOut.symbol} `))

    const amount = ethers.parseEther(WETH_AMOUNT)
    await buyToken(_routerV, _tokenIn.address, _tokenOut.address, amount, _pool.fee)
  } else {
    tokenMap.set(_tokenOut.address, swapCount + 1)
  }
}

main()

/*

const watchPoolPrice = async (_poolAddress, _fee, _tokenIn, _tokenOut) => {
  const { tokenIn, tokenOut } = await getTokenAndContract(_tokenIn, _tokenOut, provider)

  const pool = await getPoolContract(_poolAddress, _fee, provider)
  console.log(chalk.blue(`UniswapV3 Pool Address: ${await pool.contract.getAddress()}`))
  console.log(chalk.blue(`Using ${tokenIn.symbol}/${tokenOut.symbol}\n`))

  const price0 = await calculatePrice(pool.contract, tokenIn, tokenOut)
  console.log(`Calculated price: ${price0} \n`)

  pool.contract.on('Swap', () => poolPriceHandler(pool, tokenIn, tokenOut, price0))
}

const poolPriceHandler = async (_pool, _tokenIn, _tokenOut, _price0) => {

  if (!tokenMap.has(_tokenOut.address)) {
     return 
  }

  const newPrice = await calculatePrice(_pool.contract, _tokenIn, _tokenOut)
  const newFPrice = Number(newPrice)
  const oldFPrice = Number(_price0)
  const priceRatio = newFPrice / oldFPrice

  console.log(`Swap event: ${_tokenIn.symbol}/${_tokenOut.symbol}`)
  console.log(`New price ratio: ${priceRatio} \n`)
  
  // Sell _tokenOut if price reached it's target amount
  if (priceRatio >= PRICE_UPPER_LIMIT) {
    console.log(chalk.blue(`Bougth ${_tokenOut.symbol} at price: ${oldFPrice}`))
    console.log(chalk.blue(`Sell ${_tokenOut.symbol} at price: ${newFPrice}`))

    // Fetch token balances before
    const tokenBalanceBefore = await _tokenIn.contract.balanceOf(SNIPER_TRADE_ADDRESS)
    let checkToken = ""

    if (FUNDINGS.includes(_tokenIn.address)) {
      try {
        console.log(chalk.green(`Try to sell ${_tokenOut.symbol} `))
        const success = await sellToken(RouterV.V3, _tokenOut.address, _tokenIn.address, _pool.fee)
        // TODO: remove listener after tokenOut is sold
      } catch (error) {
        checkToken = _tokenOut.address
        console.log(chalk.red(`Error on sell token: ${error} \n`))

        console.log(chalk.yellow("---------------------------------------------------------"))
        console.log(chalk.yellow(`Sell manually ${_tokenOut.symbol}, address: ${_tokenOut.address}`))
        console.log(chalk.yellow("---------------------------------------------------------\n"))
      }

      if (tokenMap.delete(_tokenOut.address)) {
        console.log(`Token removed from watch list ${_tokenOut.symbol} \n`)
      }
    }

    // Fetch token balances after
    const tokenBalanceAfter = await _tokenIn.contract.balanceOf(SNIPER_TRADE_ADDRESS)
    const tokenBalanceDifference = tokenBalanceAfter - tokenBalanceBefore

    const data = {
      'WETH Balance BEFORE': ethers.formatUnits(tokenBalanceBefore, _tokenIn.decimals),
      'WETH Balance AFTER': ethers.formatUnits(tokenBalanceAfter, _tokenIn.decimals),
      'WETH Gained/Lost': ethers.formatUnits(tokenBalanceDifference.toString(), _tokenIn.decimals),
      '-': {},
      'Check token address': checkToken
    }

    console.table(data)
  }
}
  */

// Fetch latest pool data from DexScreener
/*
async function fetchLatestPools(_from, _to) {
  const chain = 'ether';
  const url = `https://public-api.dextools.io/trial/v2/pool/${chain}`;

  // Define the query parameters
  const params = {
      sort: 'creationTime',
      order: 'asc',
      from: _from,
      to: _to
  };
  
  axios.get(url, { params })
    .then(response => {
      console.log('Pool Information:', response.data);
      return response;
    })
    .catch(error => {
      console.error('Error fetching pool information:', error);
    });
}
    */
