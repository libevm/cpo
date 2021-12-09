import { createRequire } from "module";
const require = createRequire(import.meta.url);

export const COUNTERV1 = require("../out/CounterV1.sol/CounterV1.json");
export const COUNTERV2 = require("../out/CounterV2.sol/CounterV2.json");
export const CPO = require("../out/CPO.sol/CPO.json");
export const TRANSPARENT_PROXY = require('../out/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json')