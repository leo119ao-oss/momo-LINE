import liff from "@line/liff";

export async function ensureLiff(liffId: string) {
  try {
    console.log(`[LIFF] Initializing with ID: ${liffId}`);
    if (!liff.isLoggedIn()) {
      await liff.init({ liffId });
      console.log(`[LIFF] Successfully initialized with ID: ${liffId}`);
    } else {
      console.log(`[LIFF] Already logged in with ID: ${liffId}`);
    }
  } catch (error) {
    console.error(`[LIFF] Error initializing with ID ${liffId}:`, error);
    throw error;
  }
}

export async function getLineUserId() {
  try {
    const p = await liff.getProfile();
    console.log(`[LIFF] Got user profile: ${p.userId}`);
    return p.userId;
  } catch (error) {
    console.error(`[LIFF] Error getting user profile:`, error);
    throw error;
  }
}
