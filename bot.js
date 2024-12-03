require("dotenv").config()
require('./helpers/server')

const chalk = require("chalk")
const axios = require('axios');
const ethers = require("ethers");

const { getTokenAndContract, getPoolContract, calculatePrice } = require('./helpers/helpers')
const { provider, signer, uniswap, sniperTrade } = require('./helpers/initialization')
const { fetchSecurityInfo, checkSecurity, checkLpHolders, sleep } = require('./helpers/tokenSecurity')

// Use this functions for testing
const { loadAllPools, loadAllSwaps } = require('./helpers/testing')

const config = require('./config.json')
const SNIPER_TRADE_ADDRESS = config.PROJECT_SETTINGS.SNIPER_TRADE_ADDRESS
const PRICE_UPPER_LIMIT = config.PROJECT_SETTINGS.PRICE_UPPER_LIMIT
const PRICE_LOWER_LIMIT = config.PROJECT_SETTINGS.PRICE_LOWER_LIMIT
const WETH_AMOUNT = config.PROJECT_SETTINGS.WETH_AMOUNT
const FUNDINGS = Object.values(config.FUNDINGS)

const tokenMap = new Map()

const main = async () => {

  uniswap.factory.on('PoolCreated', (token0, token1, fee, tickSpacing, pool) => newPoolHandler(token0, token1, fee, tickSpacing, pool))

  console.log("Waiting for new pools...\n")
}

const newPoolHandler = async (_token0, _token1, _fee, _tickSpacing, _pool) => {
  if (tokenMap.size > 7) {
    console.log(chalk.bgRed("Token queue reached limit...\n"))
    return
  }
  
  // Sleep for 60 seconds
  await sleep(60000)

  console.log(chalk.blue(`Pool created with ${_token0} & ${_token1} at ${_pool} \n`))

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
      console.log(`LP holders: ${holders} \n`)

      console.log(chalk.green(`Try to buy token: ${tokenNew}, fee: ${_fee}\n`))

      try {
        const amount = ethers.parseEther(WETH_AMOUNT)
        const success = await executeTrade(tokenWeth, tokenNew, amount, _fee)
        if (success) {
          tokenMap.set(tokenNew, amount)
          watchPoolPrice(_pool, _fee, tokenWeth, tokenNew)
        }
      } catch (error) {
        console.log(chalk.red(`Error on buy token: ${error} \n`))
      }
    } else {
      console.log(chalk.redBright(`Token is not secure: ${tokenNew}\n`))
    }
  }

  console.log("Waiting for new pools...\n")
}

/**
 * This function performs the token exchange on Uniswap by calling the 
 * SniperTrade contract functions.
 * @param _tokenIn will be sold
 * @param _tokenOut will be bought
 * @param _amount 0 means we will sold all the balance of _tokenIn, otherwise a specific amount will be sold
 * @param _fee trading fee
 */
async function executeTrade(_tokenIn, _tokenOut, _amount, _fee) {
  if (config.PROJECT_SETTINGS.isDeployed) {

    if (_amount > 0) {
      const transaction = await sniperTrade.connect(signer).buyToken(
        config.UNISWAP.ROUTER_V3,
        _tokenIn,
        _amount,
        _tokenOut,
        _fee
      )
      await transaction.wait(0)
    } else {
      const transaction = await sniperTrade.connect(signer).sellToken(
        config.UNISWAP.ROUTER_V3,
        _tokenIn,
        _tokenOut,
        _fee
      )
      await transaction.wait(0)
    }

    console.log(chalk.green(`Trade Complete... \n`))
    return true
  }
  
  return false
}

const watchPoolPrice = async (_poolAddress, _fee, _tokenIn, _tokenOut) => {
  const { tokenIn, tokenOut } = await getTokenAndContract(_tokenIn, _tokenOut, provider)

  const pool = await getPoolContract(_poolAddress, _fee, provider)
  console.log(chalk.blue(`Uniswap Pool Address: ${await pool.contract.getAddress()}`))
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
  if (priceRatio >= PRICE_UPPER_LIMIT || priceRatio <= PRICE_LOWER_LIMIT) {
    console.log(chalk.blue(`Bougth ${_tokenOut.symbol} at price: ${oldFPrice}`))
    console.log(chalk.blue(`Sell ${_tokenOut.symbol} at price: ${newFPrice}`))

    // Fetch token balances before
    const tokenBalanceBefore = await _tokenIn.contract.balanceOf(SNIPER_TRADE_ADDRESS)
    let checkToken = ""

    if (FUNDINGS.includes(_tokenIn.address)) {
      try {
        console.log(chalk.green(`Try to sell ${_tokenOut.symbol} `))
        const success = await executeTrade(_tokenOut.address, _tokenIn.address, 0, _pool.fee)
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

main()

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
