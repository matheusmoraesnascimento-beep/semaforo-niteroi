import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.matheusmoraesnascimento.semaforoniteroi',
  appName: 'Semáforo Niterói',
  webDir: 'dist',
  backgroundColor: '#111111',
  plugins: {
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
