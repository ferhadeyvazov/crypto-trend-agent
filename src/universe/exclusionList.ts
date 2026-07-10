// ===================================================================
// Stablecoin və "wrapped" token-lərin kurasiya olunmuş siyahısı
// (sənəd, bölmə 2-nin nümunələri əsasında: "USDT, USDC, DAI, FDUSD, etc."
// və "WBTC, WETH, stETH and similar derivatives").
//
// Bu, strategiya PARAMETRİ deyil (dizayn qaydası 1-i pozmur) — bazarın
// sabit təsnifat məlumatıdır, ADX/ATR kimi "tuning" ediləsi dəyər deyil.
// Yeni stablecoin/wrapped aktiv bazara çıxanda əl ilə yenilənməlidir.
// ===================================================================

export const STABLECOIN_SYMBOLS = new Set([
  "USDT", "USDC", "DAI", "FDUSD", "TUSD", "BUSD", "USDD", "USDP",
  "GUSD", "PYUSD", "USDE", "FRAX", "LUSD", "USTC", "EURT", "USDS",
]);

export const WRAPPED_TOKEN_SYMBOLS = new Set([
  "WBTC", "WETH", "WBNB", "WSTETH", "STETH", "CBETH", "RETH", "WEETH", "WBETH", "METH",
]);

export function isExcludedAsset(baseSymbol: string): boolean {
  const upper = baseSymbol.toUpperCase();
  return STABLECOIN_SYMBOLS.has(upper) || WRAPPED_TOKEN_SYMBOLS.has(upper);
}

/** Portfel korrelyasiya qaydasında (§8) "əsas aktiv" sayılan cütlər — BTC/ETH. */
export const CORE_ASSET_PAIRS = new Set(["BTCUSDT", "ETHUSDT"]);

export function isCoreAsset(tradingPairSymbol: string): boolean {
  return CORE_ASSET_PAIRS.has(tradingPairSymbol);
}
