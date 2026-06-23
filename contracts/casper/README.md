# Casper contract layer

This workspace replaces the Solidity escrow with two Wasm artifacts:

- `contract`: stores projects, proof hashes, scores, thresholds, and one purse per project.
- `fund-session`: runs in the user's account context, passes the user's main purse to the stored contract, and funds the project purse.

The separation is intentional. A Casper stored contract should not be given a user's private key and cannot independently pull funds from a wallet.

## Build

Install Rust, the Wasm target, and the Casper contract tooling, then run:

```bash
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
```

Before production deployment, add Casper engine tests covering authorization, repeat release attempts, malformed proofs, zero-value funding, and oracle rotation. The contract is a porting scaffold, not an audited production escrow.
