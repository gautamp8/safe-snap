import { OnRpcRequestHandler, OnTransactionHandler } from '@metamask/snap-types';
export declare type Maybe<T> = Partial<T> | null | undefined;

import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';
import Safe, {SafeFactory} from '@safe-global/safe-core-sdk'
import EthersAdapter from '@safe-global/safe-ethers-lib';
import SafeServiceClient from '@safe-global/safe-service-client';
import ethers from 'ethers'


/**
 * Get a message from the origin. For demonstration purposes only.
 *
 * @param originString - The origin string.
 * @returns A message based on the origin.
 */
export const getMessage = (originString: string): string =>
  `Hello, ${originString}!`;

interface Transaction {}

interface SafeState {
  status: boolean | undefined,
  safeAddress: string | undefined,
  txs: Transaction[],
  privateKey: string | undefined | null,
}

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns `null` if the request succeeded.
 * @throws If the request method is not valid for this snap.
 * @throws If the `snap_confirm` call failed.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  const state: Maybe<SafeState> = await wallet.request({
    method: 'snap_manageState',
    params: ['get'],
  });

  // const chainId = await wallet.request({
  //   method: "eth_chainId",
  //   params: []
  // });
  // console.log({chainId})

  // FIXME: it is possible user closes the UI mid session and everything is lost if the UI
  // doesn't recover session state from snap state. So can add a method to clear all state
  // or right fix would be to read snap state and use that as initial state of the frontend.
  switch (request.method) {
    case 'clear':
      return wallet.request({
        method: 'snap_manageState',
        params: ['clear'],
      });

    case 'setStatus':
      if (request.params === undefined) throw new Error("Invalid params");
      const status = (request.params as any).status;
      if (status === undefined) throw new Error("Invalid params");      

      if (state !== undefined && state !== null && state.status !== undefined && status === state.status) {
        throw new Error("starting an already started session or stopping an already stopped session");
      }

      let newState: {[key: string]: any} = {status}

      console.log({state});
      // start: store the private key
      if (status) {
        const ethereumNode = await wallet.request({
          method: 'snap_getBip44Entropy',
          params: {
            coinType: 60,
          },
        });

        const deriveEthereumAddress = await getBIP44AddressKeyDeriver(ethereumNode as any);

        const addressKey0 = await deriveEthereumAddress(0);
        newState.privateKey = addressKey0.privateKey;
      }
      // stop: push the batch to safe queue service
      else {
        console.log({state});

        const signer = new ethers.Wallet((state as any).privateKey as any);
        const ethAdapter = new EthersAdapter({
          ethers,
          signerOrProvider: signer,
        });
        const safe = await Safe.create({
          ethAdapter,
          safeAddress: state.safeAddress,
        });
        const service = new SafeServiceClient({
          txServiceUrl: 'https://safe-transaction-goerli.safe.global/',
          ethAdapter,
        });

        const safeTxs: any[] = (state!.txs || []).map((tx: any) => ({
          to: tx.to,
          value: tx.value,
          data: tx.data,
          operation: 0
        }));

        // const txs = await Promise.all(safeTxs.map(async tx => {
        //   const safeTx = await safe.createTransaction({safeTransactionData: tx});
        //   const safeTxHash = await safe.getTransactionHash(safeTx);
        //   const signature = await safe.signTransactionHash(safeTxHash);
        //   return {
        //     safeAddress: safe.getAddress(),
        //     safeTransactionData: safeTx.data,
        //     safeTxHash,
        //     senderAddress: await signer.getAddress(),
        //     senderSignature: signature.data
        //   }
        // }));
        
        // await Promise.all(txs.map(tx => service.proposeTransaction(tx)));
      }

      return wallet.request({
        method: 'snap_manageState',
        params: [
          'update',
          newState,
        ]
      });

    case 'setSafe':
      if (request.params === undefined) throw new Error("Invalid params");
      const safeAddress = (request.params as any).safeAddress;
      if (safeAddress === undefined) throw new Error("Invalid params");

      if (state !== null && state !== undefined && state.status) {
        throw new Error("can't change safe address in an ongoing session");
      }

      return wallet.request({
        method: 'snap_manageState',
        params: ['update', {safeAddress}]
      });

    case 'hello':
      return wallet.request({
        method: 'snap_confirm',
        params: [
          {
            prompt: getMessage(origin),
            description:
              'This custom confirmation is just for display purposes.',
            textAreaContent:
              'But you can edit the snap source code to make it do something, if you want to!',
          },
        ],
      });
    default:
      throw new Error('Method not found.');
  }
};

export const onTransaction: OnTransactionHandler = async ({
  transaction,
  chainId,
}) => {
  console.log({transaction, chainId})
  const state: Maybe<SafeState> = await wallet.request({
    method: 'snap_manageState',
    params: ['get']
  });
  
  const tx = transaction;
  const newTxs = [...(state?.txs || []), tx]
  await wallet.request({
    method: 'snap_manageState',
    params: ['update', {txs: newTxs}]
  });

  return {insights: {}}
};
