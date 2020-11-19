# yEvents

yEvents is a proof-of-concept websocket server that watches for contract state updates and transactions and sends diffs to connected clients.

Contract state updates are retrieved using batched json-rpc requests and sent to clients using a bulk pub-sub style messaging format.

## Event flow

- Server subscribes to new ethereum block headers
- User subscribes to "watched contract" addresses
- Server fetches and caches ABIs for new contracts
- Server reads ABI and finds all viewable fields with no inputs
- Server performs a batched transaction request to populate state for all new contracts
  - All watched fields for all contracts are pulled with one jspn-rpc call
  - In the future users can configure an optional "batch size" (only batch 5 contracts at a time per request)
- User connects to server via websocket
- User is sent the current cached state for all watched contracts
  - Currently watched contracts are hard-coded at the server level but in the future users will be able to subscribe to specific contracts/methods/arguments (balanceOf(account))
- A new block header is received
  - Block header transactions are scanned for watched contract addresses
  - If any watched contracts are touched within the block perform a batched contract state update request
  - Compare current contracts state with new contracts state
    - If there are new contract updates send the diffs in bulk to connected websocket clients
  - Fetch detailed transaction information for transactions that touched our watched contracts
    - Decode method and arguments using the `inputs` transaction field
    - Batch and send new transactions to connected websocket clients

## Messaging format

```javascript
{
  timestamp: 1605779414530,
  events: [
    {
      eventCode: 'transactions',
      timestamp: 1605779414530,
      payload: [
        {
          contractAddress: '0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c',
          blockHash: '0x9ba930535cce1223318e970fb4f5926f0fdcafe11d3a98d4bec796b4f99698c9',
          blockNumber: 11287708,
          from: '0xDfc968aA66A31C25fc999e57E4FFc39104Db94E3',
          gas: 144130,
          gasPrice: '37000000000',
          hash: '0x8ad0887b1ae0d2e1adb8d61374770a583a0395775cd527f3412b17ccdd08d67e',
          input: '0xb6b55f2500000000000000000000000000000000000000000000021e19e0c9bab2400000',
          nonce: 36,
          to: '0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c',
          transactionIndex: 57,
          value: '0',
          v: '0x26',
          r: '0xc88533ac487213031becf4f16fd5991d80cd3d7536e4dc1dd55a390c3a8fe848',
          s: '0x6504c0a0d4d744ac089b91276f9631c7599a3a9d8b0e357ae98c8f463123913c',
          method: {
            name: 'deposit',
            params: [
              {
                name: '_amount',
                value: '10000000000000000000000',
                type: 'uint256'
              }
            ]
          }
        }
      ]
    },
    {
      eventCode: 'stateUpdates',
      timestamp: 1605779414530,
      payload: [
        {
          available: '676655028747335678677653',
          balance: '72210551477317621370426564',
          totalSupply: '64786053957949717072739790',
          address: '0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c'
        }
      ]
    }
  ]
}
```

## Installation

### Local development

```
git clone https://github.com/x48-crypto/yearn-yevents.git
cd yearn-yevents
add your API keys to config/config.js
npm install
npm start
```

### Docker

```
docker-compose up
```
