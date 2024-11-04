require("dotenv").config()
const GoPlus = require('@goplus/sdk-node');
const axios = require('axios');
const moment = require('moment')

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
        const tokenAddress = pool.mainToken.address;

        if (securityData.result && securityData.result[tokenAddress]) {
            const tokenIsSecure = checkSecurity(securityData.result[tokenAddress], tokenAddress);

            if (tokenIsSecure) {
              
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