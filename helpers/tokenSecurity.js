const { GoPlus, ErrorCode } = require('@goplus/sdk-node')

const BLACK_LIST = ['PUMPNOTFUN']

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
    let securityData = {result: {}}
    let sleepMs = 3000
    while (Object.keys(securityData.result).length === 0) {
      console.log(`Fetch Security info: ${token}`)
      securityData = await tokenSecurity(token)
  
      // Sleep for 3 seconds
      await sleep(sleepMs)
      sleepMs += 100
    }

    return securityData.result
}
  
// Check security info from GoPlus
// Analyze the Results: The API will return various security metrics and information about the token.
function checkSecurity(_securityInfo) {

    const securityList0 = ['is_open_source', 'is_in_dex', 'is_true_token']
    const result0 = securityList0.filter((key) => _securityInfo[key] === '0')

    if (result0.length > 0) {
        console.log(`Security issues: ${result0}`)
        return false
    }

    const securityList1 = [
        'is_proxy', 'is_mintable', 'owner_change_balance', 'hidden_owner', 'selfdestruct', 'external_call', 'gas_abuse',
        'is_honeypot', 'honeypot_with_same_creator', 'cannot_buy', 'cannot_sell_all', 'slippage_modifiable', 'personal_slippage_modifiable',
        'is_blacklisted', 'transfer_pausable', 'is_airdrop_scam'
    ]
    const result1 = securityList1.filter((key) => _securityInfo[key] === '1')

    if (result1.length > 0) {
        console.log(`Security issues: ${result1}`)
        return false
    }

    const tokenName = _securityInfo['token_name']
    if (BLACK_LIST.includes(tokenName)) {
        return false
    }

    let isLocked = false
    const lpHolders = _securityInfo['lp_holders']

    if (lpHolders && lpHolders.length > 0) {
        lpHolders.forEach(holder => {
            if (holder['is_locked'] === 1) {
                isLocked = true
            }
        })
    } else {
        isLocked = true
        console.log("No LP holders...")
    }

    if (!isLocked) {
        console.log("No Liquidity is locked...")
    }

    return isLocked
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const main = async () => {

    const securityData = await fetchSecurityInfo("0x3f5D8AC3fc4FE9629fDfd226e190DA445dD9F910")
    console.log(securityData)

    checkSecurity(securityData["0x3f5d8ac3fc4fe9629fdfd226e190da445dd9f910"])
}

module.exports = {
    fetchSecurityInfo,
    checkSecurity
}

main()
