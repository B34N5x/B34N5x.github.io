/* User-editable config. Never put seeds or secrets here. */
window.ESCROW_ASSISTANT_CONFIG = {
  /* Public Xaman (Xumm) API Key from https://apps.xumm.dev — safe to expose in a browser app.
     Leave empty to draft JSON only (no push-to-Xaman). */
  xummApiKey: "",
  /* Optional: your own LLM endpoint for richer parsing. Off by default.
     POST JSON { messages:[{role,content}], deal:string } → { ok:true, draft:{...} }
     The page never ships with a key; you must host the proxy yourself. */
  llmEndpoint: "",
  llmEnabled: false,
  defaultNetwork: "testnet", // "testnet" | "mainnet"
  networks: {
    testnet: {
      label: "XRPL Testnet",
      ws: "wss://testnet.xrpl-labs.com", // fallback-friendly; alt: wss://s.altnet.rippletest.net:51233,
      faucet: "https://faucet.altnet.rippletest.net/accounts",
      explorer: "https://testnet.xrpl.org",
    },
    mainnet: {
      label: "XRPL Mainnet",
      ws: "wss://xrplcluster.com",
      faucet: null,
      explorer: "https://livenet.xrpl.org",
    },
  },
};
