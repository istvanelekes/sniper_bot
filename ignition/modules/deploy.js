const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const SniperTradeModule = buildModule("SniperTradeModule", (m) => {
  const sniper = m.contract("SniperTrade");

  return { sniper };
});

module.exports = SniperTradeModule;