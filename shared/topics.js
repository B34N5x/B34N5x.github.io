(() => {
  "use strict";

  window.QU1PU_HUB = {
    title: "QU1PU AI",
    lede: "Ask about XRPL escrow, the Lending Protocol, or Single Asset Vaults. Answers come from official docs, each with a source. General information only — not financial advice.",
    topics: [
      {
        id: "escrow",
        title: "QU1PU Escrow",
        kicker: "Guided assistant",
        blurb: "Draft an XRPL escrow in plain English. You review every field, then you sign in your own wallet. QU1PU never asks for your seed and never signs for you.",
        intro: "This tile covers XRPL escrow — locking XRP until a time or condition, then finishing or cancelling it. Ask a question below, or use the guided assistant to draft a transaction. You sign in Xaman yourself.",
        educationOnly: false,
        assistant: {
          src: "escrow/?embed=1",
          page: "escrow/",
          title: "Escrow assistant",
          openLabel: "Open the escrow assistant in its own page"
        },
        queryRe: [
          String.raw`\bescrows?\b`,
          String.raw`\bescrow(?:create|finish|cancel)\b`,
          String.raw`\bfinishafter\b`,
          String.raw`\bcancel\s*after\b`,
          String.raw`\bcancelafter\b`,
          String.raw`\bcrypto-?conditions?\b`,
          String.raw`\b(?:preimage-?sha-?256|fulfillment secret)\b`,
          String.raw`\b(?:lock|time-?lock)\s+(?:xrp|funds|payments?)\b`,
          String.raw`\b(?:set\s*up|setup|create|draft|how to (?:make|create|use))\s+(?:an?\s+)?escrow\b`,
          String.raw`\b(?:how\s+(?:do|does|can|to)|set\s*up|setup|draft)\b[\s\S]{0,48}\bescrows?\b`
        ],
        docUrlRe: [
          String.raw`/docs/concepts/payment-types/escrow(?:/|$)`,
          String.raw`/docs/references/protocol/transactions/types/escrow(?:create|finish|cancel)(?:/|$)`
        ]
      },
      {
        id: "lending",
        title: "QU1PU Lending",
        kicker: "Education only",
        blurb: "Learn how the XRPL Lending Protocol works — loan brokers, vault-funded loans, and the on-ledger loan lifecycle.",
        intro: "This tile explains the XRPL Lending Protocol from official docs. It does not build or sign transactions.",
        educationOnly: true,
        caveat: "The LendingProtocol and LendingProtocolV1_1 amendments are not enabled on mainnet yet; they are still in validator voting. This tile is education only.",
        caveatSources: [
          "https://xrpl.org/resources/known-amendments",
          "https://xrpl.org/docs/concepts/tokens/lending-protocol"
        ],
        queryRe: [
          String.raw`\blend(?:ing)?\s+protocols?\b`,
          String.raw`\blending\s+amendments?\b`,
          String.raw`\blendingprotocol(?:v1[_.]?1)?\b`,
          String.raw`\bxls-?66\b`,
          String.raw`\bloan\s*brokers?\b`,
          String.raw`\b(?:loan(?:set|pay|manage|delete|create)|create\s+a\s+loan)\b`,
          String.raw`\buncollateralized\s+loans?\b`,
          String.raw`\b(?:set\s*up|setup|create|how (?:do|does|to)|what(?:'s| is))\s+(?:the\s+)?(?:xrpl\s+)?(?:lending|loan)\b`,
          String.raw`\bloans?\s+on\s+(?:the\s+)?(?:xrpl|xrp ledger)\b`,
          String.raw`\b(?:how\s+(?:do|does|can|to)|set\s*up|setup)\b[\s\S]{0,48}\b(?:lending|loans?|loan\s*brokers?)\b`
        ],
        docUrlRe: [
          String.raw`/docs/concepts/tokens/lending-protocol(?:/|$)`,
          String.raw`/tutorials/defi/lending/use-the-lending-protocol/`,
          String.raw`/docs/references/protocol/transactions/types/loan`,
          String.raw`/use-cases/defi/institutional-credit-facilities`
        ]
      },
      {
        id: "vault",
        title: "QU1PU Vault",
        kicker: "Education only",
        blurb: "Learn how Single Asset Vaults hold one asset and issue shares to depositors.",
        intro: "This tile explains XRPL Single Asset Vaults from official docs. It does not build or sign transactions.",
        educationOnly: true,
        caveat: "The SingleAssetVault amendment is not enabled on mainnet yet; it is still in validator voting. This tile is education only.",
        caveatSources: [
          "https://xrpl.org/resources/known-amendments",
          "https://xrpl.org/docs/concepts/tokens/single-asset-vaults"
        ],
        queryRe: [
          String.raw`\bsingle\s*asset\s*vaults?\b`,
          String.raw`\bsingleassetvault\b`,
          String.raw`\bxls-?65\b`,
          String.raw`\bvault(?:set|create|deposit|withdraw)s?\b`,
          String.raw`\b(?:deposit into|withdraw from|create)\s+(?:a\s+)?(?:single\s+asset\s+)?vault\b`,
          String.raw`\b(?:set\s*up|setup|create|how (?:do|does|to)|what(?:'s| is))\s+(?:an?\s+)?(?:xrpl\s+|single\s+asset\s+)?vaults?\b`,
          String.raw`\bvaults?\s+on\s+(?:the\s+)?(?:xrpl|xrp ledger)\b`,
          String.raw`\b(?:how\s+(?:do|does|can|to)|set\s*up|setup)\b[\s\S]{0,48}\b(?:single\s+asset\s+)?vaults?\b`
        ],
        docUrlRe: [
          String.raw`/docs/concepts/tokens/single-asset-vaults(?:/|$)`,
          String.raw`/tutorials/defi/lending/use-single-asset-vaults/`,
          String.raw`/docs/references/protocol/transactions/types/vault`
        ]
      }
    ]
  };
})();
