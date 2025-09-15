import liff from "@line/liff";

export async function ensureLiff(liffId: string) {
  if (!liff.isLoggedIn()) await liff.init({ liffId });
}

export async function getLineUserId() {
  const p = await liff.getProfile();
  return p.userId;
}
