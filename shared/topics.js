(() => {
  "use strict";

  window.QU1PU_HUB = {
    title: "QU1PU AI",
    lede: "Ask about XRPL escrow, the Lending Protocol, Single Asset Vaults, or the ledger’s cryptographic key types. Answers come from official docs, each with a source. General information only — not financial advice.",
    cards: [
      {
        id: "keys",
        title: "Cryptographic keys",
        kicker: "From official docs",
        reminder: "Your keys and seeds never leave your wallet. QU1PU never asks for them. You sign in Xaman yourself.",
        slides: [
          {
            id: "overview",
            title: "How to tell",
            graphic: "overview",
            lines: [
              "The XRP Ledger supports two cryptographic signing algorithms: secp256k1 and Ed25519.",
              "Official docs do not rank one key type over the other.",
              "You can tell an Ed25519 public key because xrpld prefixes it with the byte 0xED, so both types of public key are 33 bytes.",
              "Seed values in the XRP Ledger’s base58 format start with s; that describes the seed encoding in general."
            ]
          },
          {
            id: "secp256k1",
            title: "secp256k1",
            kicker: "ECDSA · elliptic curve secp256k1",
            graphic: "secp256k1",
            lines: [
              "This is the same scheme Bitcoin uses. The XRP Ledger uses these key types by default.",
              "xrpld’s wallet_propose command uses secp256k1 as the default.",
              "Keys are generated from a 16-byte seed. A private key, public key, and address are derived from that seed.",
              "These keys can be used as master key pairs, regular key pairs, and members of signer lists."
            ]
          },
          {
            id: "ed25519",
            title: "Ed25519",
            kicker: "EdDSA · elliptic curve Ed25519",
            graphic: "ed25519",
            lines: [
              "Official docs describe this as a newer algorithm with better performance and other convenient properties.",
              "Many client libraries (such as xrpl.js) use Ed25519 as the default.",
              "xrpld prefixes Ed25519 public keys with the byte 0xED, so both types of public key are 33 bytes.",
              "Address derivation is the same as for secp256k1. These keys can be used as master key pairs, regular key pairs, and members of signer lists."
            ]
          }
        ],
        body: "The XRP Ledger supports two cryptographic signing algorithms: secp256k1 (ECDSA using the elliptic curve secp256k1) and ed25519 (EdDSA using the elliptic curve Ed25519). secp256k1 is the same scheme Bitcoin uses, and the XRP Ledger uses these key types by default. Ed25519 is also supported; official docs describe it as a newer algorithm with better performance and other convenient properties. Official docs do not rank one key type over the other. Different tools have different defaults: many client libraries (such as xrpl.js) use Ed25519 as the default, but xrpld’s wallet_propose command uses secp256k1 as the default, so the same seed can produce a different address unless the algorithm is specified.\n\nYou can tell an Ed25519 public key because xrpld prefixes it with the byte 0xED, so both types of public key are 33 bytes. Official docs also record that seed values in the XRP Ledger’s base58 format start with s; that describes the seed encoding in general.\n\nAs with other cryptographic algorithms, use a standard, well-known, publicly-audited implementation whenever possible — official docs mention OpenSSL’s implementations of core Ed25519 and secp256k1 functions. Your keys and seeds never leave your wallet. QU1PU never asks for them. You sign in Xaman yourself.",
        sources: [
          { href: "https://xrpl.org/docs/concepts/accounts/cryptographic-keys", label: "Cryptographic Keys" },
          { href: "https://xrpl.org/docs/references/protocol/data-types/base58-encodings", label: "base58 Encodings" }
        ]
      }
    ],
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
