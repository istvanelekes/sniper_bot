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

