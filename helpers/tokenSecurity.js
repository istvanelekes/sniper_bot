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

    // Check Contract Security
    if (_securityInfo['is_open_source'] === '0' ||
        _securityInfo['is_proxy'] === '1' ||
        _securityInfo['is_mintable'] === '1' ||
        _securityInfo['owner_change_balance'] === '1' ||
        _securityInfo['hidden_owner'] === '1' ||
        _securityInfo['selfdestruct'] === '1' ||
        _securityInfo['external_call'] === '1' ||
        _securityInfo['gas_abuse'] === '1'
    ) {
        return false
    }

    // Check Trading Security
    if (_securityInfo['is_honeypot'] === '1' ||
        _securityInfo['honeypot_with_same_creator'] === '1' ||
        _securityInfo['is_in_dex'] === '0' ||
        _securityInfo['cannot_buy'] === '1' ||
        _securityInfo['cannot_sell_all'] === '1' ||
        _securityInfo['slippage_modifiable'] === '1' ||
        _securityInfo['personal_slippage_modifiable'] === '1' ||
        _securityInfo['is_blacklisted'] === '1' ||
        _securityInfo['transfer_pausable'] === '1'
    ) {
        return false
    }

    // Check Info Security
    if (_securityInfo['is_true_token'] === '0' ||
        _securityInfo['is_airdrop_scam'] === '1'
    ) {
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

    const securityData = await fetchSecurityInfo("0x0940CA85653FA68a8AddBCf96d7De669349B8BdB")
    checkSecurity(securityData["0x0940ca85653fa68a8addbcf96d7de669349b8bdb"])

    console.log(securityData)
}

module.exports = {
    fetchSecurityInfo,
    checkSecurity
}
