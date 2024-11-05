require("dotenv").config()
const GoPlus = require('@goplus/sdk-node');
const axios = require('axios');
const moment = require('moment')
const ethers = require("ethers")

const { provider, uniswap, sniperTrade } = require('./helpers/initialization')

// -- CONFIGURATION VALUES HERE -- //
const POOL_FEE = config.TOKENS.POOL_FEE

async function main() {
    console.log('starting...', moment.utc().toISOString())

    const from = moment.utc().subtract(1, 'seconds').toISOString();
    const to = moment.utc().toISOString();

    const latestPools = await fetchLatestPools(
        encodeURIComponent(from),
        encodeURIComponent(to)
    )
    
    // Check if there are pools
    if (latestPools.data.results.length === 0) {
        console.log('No new pools found');
        return;
    }

    // Create an array of promises for fetching security info of each pool 
    const securityPromises = latestPools.data.results.map(pool => 
        fetchSecurityInfo(pool.mainToken.address)
    );

    // Wait for all promises to resolve
    const securityDataArray = await Promise.all(securityPromises);

    // Check security for all tokens from latest pool
    securityDataArray.forEach((securityData, index) => {
        const pool = latestPools.data.results[index];
        const mainTokenAddress = pool.mainToken.address;
        const sideTokenAddress = pool.sideToken.address;
        const amount = 1;

        if (securityData.result && securityData.result[tokenAddress]) {
            const mainTokenIsSecure = checkSecurity(securityData.result[mainTokenAddress], mainTokenAddress);
            const sideTokenIsSecure = checkSecurity(securityData.result[sideTokenAddress], sideTokenAddress);

            if (mainTokenIsSecure && sideTokenIsSecure) {
                executeTrade(mainTokenAddress, sideTokenAddress, amount, pool.fee)
            }
        }
    });
}

// Fetch latest pool data from DexScreener
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

// Fetch security info from GoPlus
async function fetchSecurityInfo(_tokenAddress) {
  let chainId = "1";

  try {
      const response = await GoPlus.tokenSecurity({
        address: _tokenAddress,
        chain_id: chainId,
      });
  
      if (response.code === 0) {
        return response
      } else {
        console.error('Error:', response.message);
      }
    } catch (error) {
      console.error('Error fetching token security information:', error);
    }
}

// Check security info from GoPlus
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

async function executeTrade(_token0Address, _token1Address, _amount, _fee) {
  console.log(`Buy newly listed token...\n`)

  const routerPath = await uniswap.router.getAddress()

  // Create Signer
  const account = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  if (config.PROJECT_SETTINGS.isDeployed) {
    const transaction = await sniperTrade.connect(account).buyToken(
      routerPath,
      _token0Address,
      _amount,
      _token1Address,
      _fee
    )

    const receipt = await transaction.wait(0)
  }

  console.log(`Trade Complete:\n`)
}