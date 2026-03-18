import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(async () => {
  const plugins: PluginOption[] = [react(), tailwindcss()]

  try {
    const cloudflarePluginId = '@cloudflare/vite-plugin'
    const { cloudflare } = await import(/* @vite-ignore */ cloudflarePluginId) as {
      cloudflare?: () => PluginOption
    }
    if (typeof cloudflare === 'function') {
      plugins.push(cloudflare())
    }
  } catch {
    // Cloudflare plugin is optional for non-CF builds.
  }

  return { plugins }
})
