# USDZ MIME Type Detection

## Overview

USDZ files are ZIP archives that can contain different internal USD (Universal Scene Description) formats. This document explains how we distinguish between these formats using MIME types.

## USDZ Internal Formats

### 1. **USDA (ASCII) - Text Format**
- **MIME Type:** `model/vnd.usdz+zip`
- **File Extension:** `.usda` (inside USDZ)
- **Description:** Human-readable ASCII USD format
- **Three.js Support:** ✅ **Fully Supported** (as of Three.js r180)
- **Performance:** Good (text parsing, but optimized)
- **Use Case:** Development, debugging, version control friendly, web viewing
- **Recommended:** ✅ **Best for web compatibility**

### 2. **USDC (Crate) - Binary Format**
- **MIME Type:** `model/vnd.pixar.usd-binary+zip`
- **File Extension:** `.usdc` (inside USDZ)
- **Description:** Binary USD format
- **Three.js Support:** ❌ **Not Yet Supported** (as of Three.js r180)
- **Performance:** Excellent (compact binary format)
- **Use Case:** Production AR on iOS, file size optimization
- **Workaround:** Can be viewed in AR on iOS devices

### 3. **USDT (Text) - Alternative Text Format**
- **MIME Type:** `model/vnd.pixar.usd-text+zip`
- **File Extension:** `.usdt` (inside USDZ)
- **Description:** Alternative text-based USD format
- **Three.js Support:** ❓ **Unknown** (likely unsupported)
- **Performance:** Slower (text parsing required)
- **Use Case:** Specialized workflows
- **Workaround:** Can be viewed in AR on iOS devices

---

## Implementation Details

### Magic File Detection (`/etc/magic`)

The system uses the `file` command's magic database to detect USDZ internal formats:

```bash
# USDZ (Universal Scene Description ZIP) - Apple AR format
# USDZ files are ZIP archives (PK signature) containing .usd, .usda, .usdc, or .usdt files
# Check for specific internal formats to provide more detailed MIME types
0       string          PK\003\004
# USDA (ASCII/Text) - Supported by Three.js USDZLoader
>30     search/256      .usda           model/vnd.usdz+zip
# USDC (Crate/Binary) - NOT YET supported by Three.js USDZLoader
>30     search/256      .usdc           model/vnd.pixar.usd-binary+zip
# USDT (Text) - Support unknown
>30     search/256      .usdt           model/vnd.pixar.usd-text+zip
# Generic USD - Fallback
>30     search/256      .usd            model/vnd.usdz+zip
```

**How it works:**
1. Checks for ZIP signature (`PK\003\004`)
2. Searches first 256 bytes after offset 30 for file extensions
3. Returns specific MIME type based on internal format

---

## Django Backend Configuration

### File Upload Validation (`media/serializers.py`)

```python
allowed_types = {
    # 3D Models - USDZ files with different internal formats
    'model/vnd.usdz+zip',              # USDA (ASCII) - supported by Three.js
    'model/vnd.pixar.usd-binary+zip',  # USDC (binary) - NOT YET supported by Three.js
    'model/vnd.pixar.usd-text+zip',    # USDT (text) - support unknown
}
```

### Media Processing (`media/services.py`)

```python
# Skip processing for 3D models (USDZ files - all variants)
if mime_type in ['model/vnd.usdz+zip', 'model/vnd.pixar.usd-binary+zip', 'model/vnd.pixar.usd-text+zip']:
    logger.info(f"Skipping processing for 3D model {media_instance.id} (MIME: {mime_type})")
    return True
```

---

## Frontend Handling (SvelteKit)

### ModelViewer Component

The `ModelViewer.svelte` component handles different USDZ formats:

**USDA (Supported):**
- Loads and renders using Three.js USDZLoader
- Interactive 3D viewer with OrbitControls
- Full camera control and lighting
- ✅ **Recommended format for web viewing**

**USDC/USDT (Unsupported):**
- Detects loading error
- Shows informative error message
- Provides "View in AR" button for iOS devices
- Offers download option

**Error Detection:**
```typescript
if (errorMsg.includes('replace') || errorMsg.includes('undefined')) {
    loadError = 'This USDZ file uses an unsupported internal format (USDC or USDT). Three.js currently only supports USDA (ASCII) format.';
    usdzFormatWarning = 'The file can still be viewed in AR on iOS devices using the "View in AR" button.';
}
```

---

## User Experience

### USDA Files (ASCII) - ✅ Recommended
1. ✅ File uploads successfully
2. ✅ MIME type detected as `model/vnd.usdz+zip`
3. ✅ Three.js renders model in browser
4. ✅ Interactive 3D viewer available
5. ✅ AR Quick Look available on iOS

### USDC Files (Binary)
1. ✅ File uploads successfully
2. ✅ MIME type detected as `model/vnd.pixar.usd-binary+zip`
3. ⚠️ Three.js fails to render (expected - not yet supported)
4. ℹ️ Error message explains format incompatibility
5. ✅ "View in AR" button provided for iOS devices
6. ✅ Download option available

### USDT Files (Text)
1. ✅ File uploads successfully
2. ✅ MIME type detected as `model/vnd.pixar.usd-text+zip`
3. ⚠️ Three.js likely fails to render
4. ℹ️ Error message explains format incompatibility
5. ✅ "View in AR" button provided for iOS devices
6. ✅ Download option available

---

## Converting Between Formats

### USDC → USDA (Recommended for Web)

If you have USDC (binary) files and need web compatibility, convert to USDA (ASCII):

**Using USD Toolset:**
```bash
# Install USD from Pixar
# https://github.com/PixarAnimationStudios/USD

# Convert USDC to USDA
usdcat input.usdc --out output.usda

# Create USDZ from USDA
usdzip output.usdz output.usda
```

**Using Apple's Reality Converter (macOS):**
1. Download Reality Converter from Apple
2. Open USDZ file
3. Export as USDZ with ASCII format

**Using Blender:**
1. Import USD file
2. Export as USD with "ASCII" format selected
3. Package as USDZ

---

## Testing MIME Type Detection

### Manual Testing

```bash
# Test a USDZ file
file --mime-type your-model.usdz

# Expected outputs:
# USDA: model/vnd.usdz+zip
# USDC: model/vnd.pixar.usd-binary+zip
# USDT: model/vnd.pixar.usd-text+zip
```

### Automated Testing (Django)

```python
import magic

mime_type = magic.from_file('path/to/model.usdz', mime=True)
print(f"Detected MIME type: {mime_type}")
```

---

## Browser Compatibility

### Three.js USDZLoader Support

| Format | Chrome | Safari | Firefox | Edge |
|--------|--------|--------|---------|------|
| USDA   | ✅     | ✅     | ✅      | ✅   |
| USDC   | ❌     | ❌     | ❌      | ❌   |
| USDT   | ❌     | ❌     | ❌      | ❌   |

### AR Quick Look (iOS Only)

| Format | iPhone | iPad | Vision Pro |
|--------|--------|------|------------|
| USDC   | ✅     | ✅   | ✅         |
| USDA   | ✅     | ✅   | ✅         |
| USDT   | ✅     | ✅   | ✅         |

**Note:** All USDZ formats work in AR Quick Look regardless of internal format.

---

## Troubleshooting

### Issue: File detected as `application/zip`

**Cause:** Magic database not configured  
**Solution:** Restart Django container to apply `/etc/magic` configuration

```bash
docker compose -f compose.dev.yaml restart api
```

### Issue: Three.js shows "Cannot read properties of undefined"

**Cause:** USDC or USDT format (not yet supported)  
**Solution:** Convert to USDA (ASCII) format or use AR Quick Look on iOS

### Issue: All USDZ files show same MIME type

**Cause:** Old magic database still in use  
**Solution:**
1. Remove compiled magic file: `rm /usr/share/file/magic.mgc`
2. Restart container
3. Magic database will rebuild from `/etc/magic`

---

## Future Enhancements

### Planned Features
- [ ] Server-side USDC → USDA conversion
- [ ] Automatic format detection and conversion on upload
- [ ] Preview thumbnails for all USDZ formats
- [ ] Format conversion API endpoint

### Three.js Roadmap
- Monitor Three.js releases for USDC/USDT support
- Update ModelViewer when support is added
- Remove format warnings when fully supported

---

## References

- **USD Documentation:** https://openusd.org/
- **Three.js USDZLoader:** https://threejs.org/docs/#examples/en/loaders/USDZLoader
- **Apple AR Quick Look:** https://developer.apple.com/augmented-reality/quick-look/
- **File Magic Database:** https://www.darwinsys.com/file/
- **MIME Type Standards:** https://www.iana.org/assignments/media-types/

---

## Summary

✅ **MIME type detection** distinguishes between USDA, USDC, and USD formats  
✅ **Django backend** accepts all three formats  
✅ **Frontend** provides appropriate UX for each format  
✅ **USDA files** render in Three.js viewer  
✅ **USDC/USDT files** show helpful error with AR fallback  
✅ **iOS devices** can view all formats in AR Quick Look  

**Recommendation:** Use USDA (ASCII) format for web-based 3D viewing for best compatibility.
