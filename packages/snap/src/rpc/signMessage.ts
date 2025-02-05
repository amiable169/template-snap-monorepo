import {
  MessageRequest,
  SignMessageResponse,
  SignRawMessageResponse,
} from "@chainsafe/filsnap-types";
import { FilecoinNumber } from "@glif/filecoin-number/dist";
import { SnapsGlobalObject } from "@metamask/snaps-types";
import {
  Message,
  SignedMessage,
  transactionSignRaw,
} from "@zondax/filecoin-signing-tools/js";
import { getKeyPair } from "../filecoin/account";
import { LotusRpcApi } from "../filecoin/types";
import { showConfirmationDialog } from "../util/confirmation";
import { messageCreator } from "../util/messageCreator";
import { Wallet } from '../izari-filecoin/wallet'
import { Transaction } from '../izari-filecoin/transaction'
import { getFilAddress, getNetworkPrefix } from "../util";
import { SignatureType } from "../izari-filecoin/artifacts/wallet";

export async function signMessage(
  snap: SnapsGlobalObject,
  api: LotusRpcApi,
  messageRequest: MessageRequest
): Promise<SignMessageResponse> {
  try {
    const toFilAddress = await getFilAddress(api, messageRequest.to)
    const keypair = await getKeyPair(snap);
    // extract gas params
    const gl =
      messageRequest.gaslimit && messageRequest.gaslimit !== 0
        ? messageRequest.gaslimit
        : 0;
    const gp =
      messageRequest.gaspremium && messageRequest.gaspremium !== "0"
        ? messageRequest.gaspremium
        : "0";
    const gfc =
      messageRequest.gasfeecap && messageRequest.gasfeecap !== "0"
        ? messageRequest.gasfeecap
        : "0";
    const nonce =
      messageRequest.nonce ?? Number(await api.mpoolGetNonce(keypair.address));
    const params = messageRequest.params || "";
    const method = messageRequest.method || 0;

    // create message object
    const message: Message = {
      from: keypair.address,
      gasfeecap: gfc,
      gaslimit: gl,
      gaspremium: gp,
      method,
      nonce,
      params,
      to: messageRequest.to,
      value: messageRequest.value,
    };
    // estimate gas usage if gas params not provided
    if (
      message.gaslimit === 0 &&
      message.gasfeecap === "0" &&
      message.gaspremium === "0"
    ) {
      const messageEstimate = await api.gasEstimateMessageGas(
        {
          ...message,
          to: toFilAddress
        },
        { MaxFee: "0" },
        null
      );
      message.gaslimit = messageEstimate.GasLimit;
      message.gaspremium = messageEstimate.GasPremium;
      message.gasfeecap = messageEstimate.GasFeeCap;
    }

    // show confirmation
    const confirmation = await showConfirmationDialog(snap, {
      description: `It will be signed with address: ${message.from}`,
      prompt: `Do you want to sign this message?`,
      textAreaContent: messageCreator([
        { message: "to:", value: message.to },
        { message: "from:", value: message.from },
        {
          message: "value:",
          value: `${new FilecoinNumber(message.value, "attofil").toFil()} FIL`,
        },
        { message: "method:", value: message.method },
        { message: "params:", value: message.params },
        { message: "gas limit:", value: `${message.gaslimit} attoFIL` },
        { message: "gas fee cap:", value: `${message.gasfeecap} attoFIL` },
        { message: "gas premium:", value: `${message.gaspremium} attoFIL` },
      ]),
    });

    let sig: SignedMessage = null
    if (confirmation) {
      message.to = toFilAddress
      const accountData = Wallet.recoverAccount(await getNetworkPrefix(api), SignatureType.SECP256K1, keypair.privateKey)
      const signature = (await Wallet.signTransaction(accountData, Transaction.fromJSON({
        To: message.to,
        From: message.from,
        Value: message.value,
        Params: message.params,
        GasFeeCap: message.gasfeecap,
        GasPremium: message.gaspremium,
        GasLimit: message.gaslimit,
        Nonce: message.nonce,
        Method: message.method,
      }))).toJSON()
      sig = {message, signature: {data: signature.Data, type: signature.Type}}
    }

    return { confirmed: confirmation, error: null, signedMessage: sig };
  } catch (e: unknown) {
    return { confirmed: false, error: e as Error, signedMessage: null };
  }
}

export async function signMessageRaw(
  snap: SnapsGlobalObject,
  rawMessage: string
): Promise<SignRawMessageResponse> {
  try {
    const keypair = await getKeyPair(snap);
    const confirmation = await showConfirmationDialog(snap, {
      description: `It will be signed with address: ${keypair.address}`,
      prompt: `Do you want to sign this message?`,
      textAreaContent: rawMessage,
    });

    let sig: string = null;
    if (confirmation) {
      sig = transactionSignRaw(rawMessage, keypair.privateKey).toString(
        "base64"
      );
    }

    return { confirmed: confirmation, error: null, signature: sig };
  } catch (e: unknown) {
    return { confirmed: false, error: e as Error, signature: null };
  }
}
