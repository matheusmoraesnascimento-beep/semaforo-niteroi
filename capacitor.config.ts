import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.matheusmoraesnascimento.semaforoniteroi',
  appName: 'NitRotas',
  webDir: 'dist',
  backgroundColor: '#111111',
  plugins: {
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
