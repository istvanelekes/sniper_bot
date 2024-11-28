require("dotenv").config()
require('./helpers/server')

const axios = require('axios');
const ethers = require("ethers");

const { getTokenAndContract, getPoolContract, calculatePrice } = require('./helpers/helpers')
const { provider, signer, uniswap, sniperTrade } = require('./helpers/initialization')
const { fetchSecurityInfo, checkSecurity } = require('./helpers/tokenSecurity')

// Use this functions for testing
const { loadAllPools, loadAllSwaps } = require('./helpers/testing')

const config = require('./config.json')
const UNITS = config.PROJECT_SETTINGS.PRICE_UNITS
const PRICE_MULTIPLIER = config.PROJECT_SETTINGS.PRICE_MULTIPLIER
const WETH_AMOUNT = config.PROJECT_SETTINGS.WETH_AMOUNT
const FUNDINGS = Object.values(config.FUNDINGS)

let isExecutingSwap = false
let watchList = {}

const main = async () => {

  uniswap.factory.on('PoolCreated', (token0, token1, fee, tickSpacing, pool) => newPoolHandler(token0, token1, fee, tickSpacing, pool))

  console.log("Waiting for new pools...\n")
}

const newPoolHandler = async (_token0, _token1, _fee, _tickSpacing, _pool) => {
  if (Object.keys(watchList).length > 7) {
    console.log("Token queue reached limit...\n")
    return
  }

  console.log(`Pool created with ${_token0} & ${_token1} at ${_pool} \n`)

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

  if (securityData && securityData[tokenKey]) {
    console.log("Check Security info...\n")
    const tokenIsSecure = checkSecurity(securityData[tokenKey], tokenNew)

    if (tokenIsSecure) {
      try {
        const amount = ethers.parseEther(WETH_AMOUNT)
        const success = await executeTrade(tokenWeth, tokenNew, amount, _fee)
        if (success) {
          watchList[tokenNew] = amount
          watchPoolPrice(_pool, _fee, tokenWeth, tokenNew)
        }
      } catch (error) {
        console.log(`Error on buy token: ${error} \n`)
      }
    } else {
      console.log(`Token is not secure: ${tokenNew}\n`)
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
    console.log(`Sniper Trade address: ${await sniperTrade.getAddress()}\n`)

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

    console.log(`Trade Complete... \n`)
    return true
  }
  
  return false
}

const watchPoolPrice = async (_poolAddress, _fee, _tokenIn, _tokenOut) => {
  const { tokenIn, tokenOut } = await getTokenAndContract(_tokenIn, _tokenOut, provider)

  const tokenOutBalance = await tokenOut.contract.balanceOf(sniperTrade)
  console.log(`Watch ${tokenOut.symbol}, balance is: ${tokenOutBalance}`)

  const pool = await getPoolContract(_poolAddress, _fee, provider)
  console.log(`Uniswap Pool Address: ${await pool.contract.getAddress()}`)
  console.log(`Using ${tokenIn.symbol}/${tokenOut.symbol}\n`)

  const price0 = await calculatePrice(pool.contract, tokenIn, tokenOut)
  console.log(`Calculated price: ${price0} \n`)

  pool.contract.on('Swap', () => poolPriceHandler(pool, tokenIn, tokenOut, price0))
}

const poolPriceHandler = async (_pool, _tokenIn, _tokenOut, _price0) => {

  if (isExecutingSwap || watchList[_tokenOut.address] === 0) {
     return 
  }

  isExecutingSwap = true

  const newPrice = await calculatePrice(_pool.contract, _tokenIn, _tokenOut)

  // const newFPrice = Number(_newPrice).toFixed(UNITS)
  // const oldFPrice = Number(_price0).toFixed(UNITS)
  const newFPrice = Number(newPrice)
  const oldFPrice = Number(_price0)

  console.log(`Swap event: ${_tokenIn.symbol}/${_tokenOut.symbol}`)
  console.log(`New price event: ${newFPrice / oldFPrice} \n`)
  
  // Sell _tokenOut if price reached it's target amount
  if (newFPrice >= oldFPrice * PRICE_MULTIPLIER) {
    console.log(`Bougth ${_tokenOut.symbol} at price: ${oldFPrice}`)
    console.log(`Sell ${_tokenOut.symbol} at price: ${newFPrice}`)
    console.log(`-----------------------------------------\n`)

    // Fetch token balances before
    const tokenBalanceBefore = await _tokenIn.contract.balanceOf(sniperTrade.getAddress())
    const ethBalanceBefore = await provider.getBalance(signer.address)

    if (FUNDINGS.includes(_tokenIn.address)) {
      try {
        const tokenOutBalance = await _tokenOut.contract.balanceOf(sniperTrade)
        console.log(`Try to sell ${_tokenOut.symbol}, balance is: ${tokenOutBalance}`)

        const success = await executeTrade(_tokenOut.address, _tokenIn.address, 0, _pool.fee)
        if (success) {
          // TODO: remove listener after tokenOut is sold
          watchList[_tokenOut.address] = 0
          console.log(`Token removed from watch list ${_tokenOut.symbol} \n`)

        }
      } catch (error) {
        console.log(`Error on sell token: ${error} \n`)
      }
    }

    // Fetch token balances after
    const tokenBalanceAfter = await _tokenIn.contract.balanceOf(sniperTrade.getAddress())
    const ethBalanceAfter = await provider.getBalance(signer.address)

    const tokenBalanceDifference = tokenBalanceAfter - tokenBalanceBefore
    const ethBalanceDifference = ethBalanceBefore - ethBalanceAfter

    const data = {
      'ETH Balance Before': ethers.formatUnits(ethBalanceBefore, 18),
      'ETH Balance After': ethers.formatUnits(ethBalanceAfter, 18),
      'ETH Spent (gas)': ethers.formatUnits(ethBalanceDifference.toString(), 18),
      '-': {},
      'WETH Balance BEFORE': ethers.formatUnits(tokenBalanceBefore, _tokenIn.decimals),
      'WETH Balance AFTER': ethers.formatUnits(tokenBalanceAfter, _tokenIn.decimals),
      'WETH Gained/Lost': ethers.formatUnits(tokenBalanceDifference.toString(), _tokenIn.decimals),
      '-': {},
      'Total Gained/Lost': `${ethers.formatUnits((tokenBalanceDifference - ethBalanceDifference).toString(), _tokenIn.decimals)}`
    }

    console.table(data)
  }
  isExecutingSwap = false
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
