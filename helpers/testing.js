const Big = require('big.js')

/// this function is for testing purposes, by going backward on the blockchain
async function loadAllPools(_newPoolHandler, _block, _uniswapFactory) {

    while (_block > 0) {

        const poolStream = await _uniswapFactory.queryFilter('PoolCreated', _block, _block + 1)

        if (poolStream.length > 0) {
            const pools = poolStream.map(event => {
                return { hash: event.transactionHash, args: event.args}
            })

            pools.forEach(element => {
                // we need to send the block number for the swap events
                _newPoolHandler.apply(this, element.args.concat([_block]))
            });
        }

        _block -= 1
    }
}

async function loadAllSwaps(_poolPriceHandler, _blockNumber, _lastBlock, _pool, _tokenIn, _tokenOut) {
    let price0
    while (_blockNumber < _lastBlock) {

        const initEvent = await _pool.contract.queryFilter('Initialize', _blockNumber, _blockNumber + 1)

        if (initEvent.length > 0) {
            price0 = calculatePrice(initEvent[0].args[0], _tokenIn, _tokenOut)
            console.log(`Initialize with price: ${price0}`)
        }

        const swapStream = await _pool.contract.queryFilter('Swap', _blockNumber, _blockNumber + 1)  

        if (swapStream.length > 0) {
            const swaps = swapStream.map(event => {
                return { hash: event.transactionHash, args: event.args}
            })
        
            swaps.forEach((element) => {
                const price1 = calculatePrice(element.args[4], _tokenIn, _tokenOut)
                _poolPriceHandler(_pool, _tokenIn, _tokenOut, price0, price1)
            });
        }   

        _blockNumber++
    }
}

function calculatePrice(_sqrtPriceX96, _token0, _token1) {
    // Understanding Uniswap V3 prices
    // --> https://blog.uniswap.org/uniswap-v3-math-primer
  
    // Get decimalDifference if there is a difference...
    const decimalDifference = Number(Big(_token0.decimals - _token1.decimals).abs())
    const conversion = Big(10).pow(decimalDifference)
  
    // Calculate rate and price...
    const rate = Big((Big(_sqrtPriceX96).div(Big(2 ** 96))) ** Big(2))
    const price = Big(rate).div(Big(conversion)).toString()
  
    if (price == 0) {
      return Big(rate).mul(Big(conversion)).toString()
    } else {
      return price
    }
}

module.exports = {
    loadAllPools,
    loadAllSwaps
}