// These are public Firebase web-app selectors, never Admin SDK credentials.
export function firebaseConfig(env) {
  const names = {
    apiKey: "VITE_FIREBASE_API_KEY",
    authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
    projectId: "VITE_FIREBASE_PROJECT_ID",
    storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
    appId: "VITE_FIREBASE_APP_ID",
  };
  return Object.fromEntries(Object.entries(names).map(([field, name]) => {
    const value = env[name]?.trim();
    if (!value) throw Error(`กรุณาตั้งค่า ${name} ก่อน build เว็บจริง`);
    return [field, value];
  }));
}
