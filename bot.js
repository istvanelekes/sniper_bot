require("dotenv").config()

const { GoPlus, ErrorCode } = require('@goplus/sdk-node');
const axios = require('axios');
const ethers = require("ethers");
const ERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json')

const { provider, uniswap, sniperTrade } = require('./helpers/initialization')
const config = require('./config.json')

let isExecuting = false

const main = async () => {

  await loadAllPools(provider, uniswap.factory)

  uniswap.factory.on('PoolCreated', (token0, token1, fee, tickSpacing, pool) => newPoolHandler(token0, token1, fee, tickSpacing, pool))

  console.log("Waiting for new pools...\n")
}

const newPoolHandler = async (token0, token1, fee, tickSpacing, pool) => {
    if (!isExecuting) {
        isExecuting = true

        console.log(`Pool created with ${token0} & ${token1} at ${pool}`)

        console.log("Fetch Security info...\n")
        const securityData = await fetchSecurityInfo(token0)
        const tokenKey = token0.toLowerCase()

        if (securityData.result && securityData.result[tokenKey]) {
          console.log("Check Security info...\n")
          const tokenIsSecure = checkSecurity(securityData.result[tokenKey], token0)

          if (tokenIsSecure) {
              const amount = ethers.parseUnits('10', 6)
              try {
                await executeTrade(token1, token0, amount, fee)
              } catch (error) {
                console.error(error)
              }
          }
        }

        isExecuting = false

        console.log("Waiting for new pools...\n")
    }
}

// Fetch security info from GoPlus
const fetchSecurityInfo = async (_token0) => {
  let chainId = "1";
  
  // It will only return 1 result for the 1st token address if not called getAccessToken before
  let res = await GoPlus.tokenSecurity(chainId, [_token0], 30);
  if (res.code != ErrorCode.SUCCESS) {
    console.error(res.message);
  } else {
    return res
  } 
}

// Check security info from GoPlus

// Analyze the Results: The API will return various security metrics and information about the token. This may include:

// Contract vulnerabilities
// Token blacklist status
// Ownership and control details
// Code audits and reviews
// Historical security incidents
async function checkSecurity(_securityInfo, _tokenAddress) {
  if (_securityInfo['is_open_source'] === false ||
    _securityInfo['is_honeypot'] === true ||
    _securityInfo['is_in_dex'] === false ||
    _securityInfo['cannot_buy'] === true
  ) {
      return false;
  }

  return true;
}

async function executeTrade(_tokenIn, _tokenOut, _amount, _fee) {
  console.log(`Buy newly listed token...\n`)

  const routerPath = await uniswap.router.getAddress()

  // Create Signer
  const account = (config.PROJECT_SETTINGS.isLocal) ? await provider.getSigner() : new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  if (config.PROJECT_SETTINGS.isDeployed) {
    console.log(`Sniper Trade address: ${await sniperTrade.getAddress()}\n`)

    const transaction = await sniperTrade.connect(account).buyToken(
      routerPath,
      _tokenIn,
      _amount,
      _tokenOut,
      _fee
    )

    const receipt = await transaction.wait(0)
    console.log(`Trade Complete: ${receipt} \n`)
  }
}

const loadAllPools = async (provider, uniswap) => {

  let block = await provider.getBlockNumber()

  while (block > 0) {
  
    const poolStream = await uniswap.queryFilter('PoolCreated', block - 1, block)  

    if (poolStream.length > 0) {
      const pools = poolStream.map(event => {
        return { hash: event.transactionHash, args: event.args }
      })

      pools.forEach(element => {
        newPoolHandler.apply(this, element.args)
      });
    }

    block -= 1
  }
}

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

main()