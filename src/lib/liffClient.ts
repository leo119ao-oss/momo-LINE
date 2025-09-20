import liff from "@line/liff";

export async function ensureLiff(liffId: string) {
  try {
    console.log('[LIFF] Initializing LIFF with ID:', liffId);
    
    if (!liff.isInClient()) {
      console.log('[LIFF] Not in LINE client, redirecting to LINE app');
      window.location.href = `https://line.me/R/ti/p/${liffId}`;
      return;
    }

    if (!liff.isLoggedIn()) {
      console.log('[LIFF] Not logged in, initializing...');
      await liff.init({ liffId });
      
      if (!liff.isLoggedIn()) {
        console.log('[LIFF] Login required, redirecting...');
        liff.login();
        return;
      }
    }
    
    console.log('[LIFF] LIFF initialized successfully');
  } catch (error) {
    console.error('[LIFF] Error initializing LIFF:', error);
    throw error;
  }
}

export async function getLineUserId() {
  try {
    console.log('[LIFF] Getting user profile...');
    const profile = await liff.getProfile();
    console.log('[LIFF] User profile retrieved:', profile.userId);
    return profile.userId;
  } catch (error) {
    console.error('[LIFF] Error getting user profile:', error);
    throw error;
  }
}
