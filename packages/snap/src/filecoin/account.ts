import { Buffer } from "buffer";
import { keyRecover } from "@zondax/filecoin-signing-tools/js";
import { KeyPair } from "@chainsafe/filsnap-types";
import {
  getBIP44AddressKeyDeriver,
  JsonBIP44CoinTypeNode,
} from "@metamask/key-tree";
import { SnapsGlobalObject } from "@metamask/snaps-types";
import { MetamaskState } from "../interfaces";

/**
 * Return derived KeyPair from seed.
 * @param snap
 */
export async function getKeyPair(snap: SnapsGlobalObject): Promise<KeyPair> {
  const snapState = (await snap.request({
    method: "snap_manageState",
    params: { operation: "get" },
  })) as unknown as MetamaskState;
  const { derivationPath } = snapState.filecoin.config;
  const [, , coinType, account, change, addressIndex] =
    derivationPath.split("/");
  const bip44Code = coinType.replace("'", "");
  const isFilecoinMainnet = bip44Code === "461";

  const bip44Node = (await snap.request({
    method: "snap_getBip44Entropy",
    params: {
      coinType: Number(bip44Code),
    },
  })) as JsonBIP44CoinTypeNode;

  const addressKeyDeriver = await getBIP44AddressKeyDeriver(bip44Node, {
    account: parseInt(account),
    change: parseInt(change),
  });
  const extendedPrivateKey = await addressKeyDeriver(Number(addressIndex));

  const privateKey = extendedPrivateKey.privateKeyBytes;
  const privateKeyBuffer = Buffer.from(privateKey).slice(0, 32);

  const extendedKey = keyRecover(privateKeyBuffer, !isFilecoinMainnet);

  return {
    address: extendedKey.address,
    privateKey: extendedKey.private_base64,
    publicKey: extendedKey.public_hexstring,
  };
}
