// Source-derived Minima `history` / `txpow` / `scripts` shapes (minima-global/Minima master:
// history.java, txpow.java, TxPoW/TxHeader/TxBody/Transaction/Coin/Token toJSON). Replace with
// Pi-recorded responses once captured (#652 step 0).

export const LOCAL_ADDRESS = "0xDE111E13DBA5054DFF657969BF3A76BFB6CE196F95F6EBEFE1B70FED0115EF1A";
export const LOCAL_MINIADDRESS = "MxG086U24F17MT50Y6VUPBPD6VJKTYVMR71WRSYURYUVZDN1VMG25FF39M0458A";
export const EXTERNAL_ADDRESS = "0x77B5A6C0B6C1E7E9A4D3C2B1A0F9E8D7C6B5A4F3E2D1C0B9A8F7E6D5C4B3A2F1";
export const EXTERNAL_MINIADDRESS = "MxEXTERNALFIXTURE";
export const TOKEN_ID = "0xAB12CD34";

type CoinInput = { address: string; miniaddress?: string; amount: string; tokenid?: string; tokenName?: unknown };

export function historyCoin({ address, miniaddress, amount, tokenid = "0x00", tokenName }: CoinInput) {
  return {
    coinid: "0x01",
    amount,
    address,
    miniaddress: miniaddress ?? (address === LOCAL_ADDRESS ? LOCAL_MINIADDRESS : EXTERNAL_MINIADDRESS),
    tokenid,
    token: tokenid === "0x00" ? null : { name: tokenName ?? "Fixture Token", tokenid, decimals: 8 },
    ...(tokenid === "0x00" ? {} : { tokenamount: amount }),
    storestate: false,
    state: [],
    spent: false,
    mmrentry: "0",
    created: "0"
  };
}

export function historyTxpow(txpowid: string, timemilli: number, inputs: unknown[], outputs: unknown[]) {
  return {
    txpowid,
    isblock: false,
    istransaction: true,
    superblock: 0,
    size: 1024,
    burn: 0,
    header: { chainid: "0x00", block: "100", timemilli: String(timemilli), date: new Date(timemilli).toString() },
    hasbody: true,
    body: { txn: { inputs, outputs, state: [], linkhash: "0x00", transactionid: "0x02" }, burntxn: {}, txnlist: [] }
  };
}

export function historyBody(items: { txpow: unknown; difference: Record<string, string> }[]) {
  return {
    status: true,
    response: {
      relevant: true,
      txpows: items.map((item) => item.txpow),
      details: items.map((item) => ({ inputs: {}, outputs: {}, difference: item.difference })),
      size: items.length
    }
  };
}

export function scriptsBody(extra: Record<string, unknown>[] = []) {
  return {
    status: true,
    response: [
      { script: "RETURN SIGNEDBY(0xABCD)", address: LOCAL_ADDRESS, miniaddress: LOCAL_MINIADDRESS, default: true, simple: true, publickey: "0xABCD", track: true },
      ...extra
    ]
  };
}
