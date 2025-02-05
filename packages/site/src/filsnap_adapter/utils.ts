// Check if window is defined (so if in the browser or in node.js).
const isBrowser = typeof window !== "undefined"

export function hasMetaMask(): boolean {
  if (!isBrowser) {
    return false
  }
  if (!window.ethereum) {
    return false;
  }
  return window.ethereum.isMetaMask;
}

export type GetSnapsResponse = {
  [k: string]: {
    permissionName?: string;
    id?: string;
    version?: string;
    initialPermissions?: { [k: string]: unknown };
  };
};
async function getWalletSnaps(): Promise<GetSnapsResponse> {
  return await window.ethereum.request({
    method: "wallet_getSnaps",
  });
}

export async function isMetamaskSnapsSupported(): Promise<boolean> {
  try {
    await getWalletSnaps();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 *
 * @returns
 */
export async function isSnapInstalled(
  snapOrigin: string,
  version?: string
): Promise<boolean> {
  console.log(await getWalletSnaps());
  try {
    return !!Object.values(await getWalletSnaps()).find(
      (permission) =>
        permission.id === snapOrigin &&
        (!version || permission.version === version)
    );
  } catch (e) {
    console.log("Failed to obtain installed snaps", e);
    return false;
  }
}
