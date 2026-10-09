# Private Minima Testnet on a Dev Pi

How to switch a dev Pi's Minima node onto a private two-node test network, so wallet features (incoming payments, history, confirmations) can be tested with free test coins. Dev devices only — never a production install.

[`docker-compose.testnet.yml`](../../docker-compose.testnet.yml) adds:

- **`minima-testnet-peer`:** a `solo` node. It creates the test chain and its coins on first run, mines a block about every 20 seconds, and plays the "other wallet". RPC on `127.0.0.1:${MINIMA_TESTNET_PEER_RPC_PORT:-9205}` (Pi only), data in `./minima-testnet-peer`.
- **`minima` override:** test params, connects only to the peer, no public peers or Megammr rescue node.

The app's backend keeps talking to `minima:9005`, so it sees the testnet wallet without changes.

## Switch to the testnet

`/opt/edge-studio` is root-owned, so keep the override in your home folder. Compose still resolves `.env` and relative paths from `/opt/edge-studio`.

```bash
mkdir -p ~/edge-studio-testnet   # copy docker-compose.testnet.yml here
cd /opt/edge-studio
MINIMA_DATA_DIR=./minima-testnet docker compose -f docker-compose.yml \
  -f ~/edge-studio-testnet/docker-compose.testnet.yml up -d minima minima-testnet-peer
```

`MINIMA_DATA_DIR=./minima-testnet` gives the test node its own data folder; the mainnet wallet and chain in `./minima` are not touched. The test node creates a new wallet with a new seed phrase. The app's local address-book entry follows that wallet while the testnet runs.

Your user needs Docker access (`sudo usermod -aG docker <user>`, then log in again).

## Use it

```bash
peer() { curl -s "http://127.0.0.1:9205/$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1")"; }
pinode() { curl -s "http://127.0.0.1:9005/$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1")"; }

peer balance                                   # genesis coins
pinode getaddress                              # a Pi wallet address
peer "send amount:10 address:<Pi address>"     # incoming payment on the Pi
pinode "history max:5"
```

A payment is confirmed after 3 blocks (about a minute); coins are only sendable once confirmed. Test mode creates 8 default addresses, not 64.

## Switch back to mainnet

```bash
cd /opt/edge-studio
docker compose up -d minima
docker compose -f docker-compose.yml -f ~/edge-studio-testnet/docker-compose.testnet.yml stop minima-testnet-peer
```

The plain `up` recreates `minima` with `.env`'s `MINIMA_DATA_DIR` and mainnet settings. The testnet folders stay on disk; delete `./minima-testnet` and `./minima-testnet-peer` (root-owned) to start a fresh chain next time.
