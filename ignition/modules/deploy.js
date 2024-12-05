const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SniperTradeModule2 = buildModule("SniperTradeModule2", (m) => {
  const sniper = m.contract("SniperTrade");

  return { sniper };
});

module.exports = SniperTradeModule2;