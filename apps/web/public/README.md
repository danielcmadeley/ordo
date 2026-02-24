# PWA Assets

This directory contains Progressive Web App (PWA) assets.

## Files

- `favicon.svg` - Browser favicon (SVG, scalable)
- `apple-touch-icon.svg` - iOS home screen icon (180x180 SVG)

## For Production

For a proper PWA experience, replace these SVG placeholders with actual PNG icons:

### Required Icons
- `icon-192x192.png` - PWA icon (192x192 PNG)
- `icon-512x512.png` - PWA icon (512x512 PNG)
- `apple-touch-icon.png` - iOS home screen icon (180x180 PNG)
- `favicon.ico` - Browser favicon (32x32 or multi-size ICO)

### Recommended Tools
- [PWA Asset Generator](https://pwa-asset-generator.nicepkg.cn/) - Generate all PWA icons from a single image
- [Favicon.io](https://favicon.io/) - Create favicon files
- [Maskable.app](https://maskable.app/) - Generate maskable icons for Android

### Generate Icons Command

If you have a source image (e.g., `logo.png`):

```bash
# Using pwa-asset-generator (requires npm install -g pwa-asset-generator)
pwa-asset-generator logo.png public/ --icon-only --opaque

# Or use online tools to create:
# - icon-192x192.png
# - icon-512x512.png  
# - apple-touch-icon.png
# - favicon.ico
```

## Configuration

Icons are configured in `vite.config.ts` under the `VitePWA` plugin options.