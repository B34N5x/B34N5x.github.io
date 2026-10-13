# Custody note (applies to all of Arnhel's XRP/XRPL projects)

**Rule:** any design where one party holds, uses or signs with another person's key, or signs/approves
transactions on someone else's behalf (delegated signing, a tool/app/bot signing for users, holding a
secret or preimage for others, multi-party signing set up and run by us), counts as **key custody**.
Xaman support advised this needs a licence from the local regulator (they asked for a custody licence).

**What to do:** avoid it, or **stop and escalate to Arnhel before building**.

**Safe pattern:** each person signs only their own transactions in their own wallet (e.g. their own Xaman).
Our tools only read the ledger and prepare **unsigned** payloads for the account holder. No seeds, private
keys or secrets are ever asked for, stored or handled. Testnet only unless Arnhel explicitly approves otherwise.

## PRE_SCREEN (standing rule, all Arnhel XRP/XRPL projects)
Before proposing or building any feature, screen it for custody / delegated-signing risk: could anyone
(us, a tool, a server, a bot, a family member) hold, store, use or sign with another person's key, seed,
secret or preimage, sign or approve on their behalf, control their account via RegularKey/SignerList, or
create sign requests for accounts that aren't the requester's own? If yes or unsure, stop and escalate to
Arnhel before building (Xaman support treats this as key custody needing a regulator licence).
