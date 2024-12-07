const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SniperTradeModule4 = buildModule("SniperTradeModule4", (m) => {
  const sniper = m.contract("SniperTrade");

  return { sniper };
});

module.exports = SniperTradeModule4;