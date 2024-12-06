const { GoPlus, ErrorCode } = require('@goplus/sdk-node')

const chalk = require("chalk")

const WHITE_LIST = ['paul', 'atkins', 'conan', 'trump', 'elvis', 'rlusd', 'gold', 'czar', 'david', 'sacks']
const BLACK_LIST = ['PUMPNOTFUN', 'Nice', 'Akuma Inu']

// Fetch security info from GoPlus
const tokenSecurity = async (token0) => {
    let chainId = "8453";

    // It will only return 1 result for the 1st token address if not called getAccessToken before
    let res = await GoPlus.tokenSecurity(chainId, [token0], 30);
    if (res.code != ErrorCode.SUCCESS) {
        console.error(res.message);
        return {result: {}}
    } else {
        return res
    } 
}

const fetchSecurityInfo = async (token) => {
    console.log(`Fetch Security info: ${token}`)
    let securityData = {result: {}}
    let sleepMs = 0
    while (Object.keys(securityData.result).length === 0 && sleepMs < 1000) {
      securityData = await tokenSecurity(token)
  
      await sleep(3000 + sleepMs)
      sleepMs += 100
    }

    return securityData.result
}

const checkLpHolders = async (_securityInfo, _token) => {
    const lpHolderKey = 'lp_holder_count'
    let lpHolders = Number(_securityInfo[lpHolderKey])
    let sleepMs = 0

    while (lpHolders === 0 && sleepMs < 1000) {
      console.log("Check LP holders...\n")
      const securityData = await tokenSecurity(_token)
      const tokenKey = _token.toLowerCase()
      lpHolders = Number(securityData.result[tokenKey][lpHolderKey])
      
      // Sleep for 3 seconds
      await sleep(3000 + sleepMs)
      sleepMs += 100
    }

    return (lpHolders >= 1)
}
  
// Check security info from GoPlus
// Analyze the Results: The API will return various security metrics and information about the token.
function checkSecurity(_securityInfo) {

    const securityList0 = ['is_open_source', 'is_true_token']
    const result0 = securityList0.filter((key) => _securityInfo[key] === '0')

    if (result0.length > 0) {
        console.log(chalk.redBright(`Security issues: ${result0}`))
        return false
    }

    const securityList1 = [
        'is_proxy', 'is_mintable', 'owner_change_balance', 'hidden_owner', 'selfdestruct', 'external_call', 'gas_abuse',
        'is_honeypot', 'honeypot_with_same_creator', 'cannot_buy', 'cannot_sell_all', 'slippage_modifiable', 'personal_slippage_modifiable',
        'is_blacklisted', 'transfer_pausable', 'is_airdrop_scam', 'trading_cooldown'
    ]
    const result1 = securityList1.filter((key) => _securityInfo[key] === '1')

    if (result1.length > 0) {
        console.log(chalk.redBright(`Security issues: ${result1}`))
        return false
    }

    const sellTax = Number(_securityInfo['sell_tax'])
    if (sellTax > 0.0005) {
        console.log(chalk.redBright(`Sell tax: ${sellTax}`))
        return false
    }

    const buyTax = Number(_securityInfo['buy_tax'])
    if (buyTax > 0.0005) {
        console.log(chalk.redBright(`Buy tax: ${buyTax}`))
        return false
    }

    const tokenName = _securityInfo['token_name']
    const tokenSymbol = _securityInfo['token_symbol']
    if (BLACK_LIST.includes(tokenName)) {
        return false
    }

    for (let index = 0; index < WHITE_LIST.length; index++) {
        const item = WHITE_LIST[index]
        if (tokenName && tokenName.toLowerCase().includes(item)) {
            return true
        }

        if (tokenSymbol && tokenSymbol.toLowerCase().includes(item)) {
            return true
        }
    }

    return false
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const main = async () => {
    const tokenAddress = "0x198F6496a3F67A2376f6FdFad145B4b51e3Fd63A"

    const securityData = await fetchSecurityInfo(tokenAddress)
    console.log(securityData)

    const securityInfo = securityData[tokenAddress.toLowerCase()]
    checkSecurity(securityInfo)

    const holders = await checkLpHolders(securityInfo, tokenAddress)
    console.log(`LP holders: ${holders}`)
}

module.exports = {
    fetchSecurityInfo,
    checkSecurity,
    checkLpHolders,
    sleep
}