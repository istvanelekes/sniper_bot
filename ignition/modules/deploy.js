const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SniperTradeModule3 = buildModule("SniperTradeModule3", (m) => {
  const sniper = m.contract("SniperTrade");

  return { sniper };
});

module.exports = SniperTradeModule3;