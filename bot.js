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

