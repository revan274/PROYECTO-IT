import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()]

  try {
    // @ts-ignore - optional dependency for Cloudflare builds.
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    if (typeof cloudflare === 'function') {
      plugins.push(cloudflare())
    }
  } catch {
    // Cloudflare plugin is optional for non-CF builds.
  }

  return { plugins }
})
