import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saejipneukkeim.partner',
  appName: '새집느낌 파트너',
  webDir: 'public',
  server: {
    url: 'https://cleaning-scheduler-chi.vercel.app',
    cleartext: true
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
