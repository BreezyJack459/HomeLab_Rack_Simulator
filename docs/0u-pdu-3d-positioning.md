# 0U PDU 3D Positioning — Status & Pending Items

## What was implemented

### Positioning (rear-post anchored)
- `SIDE_DEVICE_GAP = 0.08` — inner face sits just outside rack frame
- `REAR_POST_INSET = 0` — rear face flush with rear rack plane
- **X**: `±(rackWidth/2 + gap + width/2)` — extends outward from rack edge
- **Z**: `-rackDepth/2 + depth/2` — extends forward from rear plane
- **Y**: `0` — full rack height, centered vertically

### Visibility fixes applied
- `DeviceModel.tsx`: Side devices get `emissiveIntensity = 0.12` (was 0.04)
- `CableViewer3D.tsx`: 0U devices get `opacity = 0.72` (was 0.34), color `#475569`

### Debug helpers added
- Yellow wireframe bounding box around each side device
- Orange gap line (X separation from rack edge)
- Red rear-face marker (Z flush with rear plane)
- 4 post anchor spheres (FL, FR, RL, RR)
- 2 0U anchor spheres (0U-L, 0U-R)

## User feedback — needs revisiting

User provided a real rack photo showing the 0U PDU mounted on the **outer face of the vertical rail** (not just near the rear post). The PDU outlets face **outward** (toward the viewer when looking at the rack side).

Current implementation places the PDU flush with the rear plane (`z = -rackDepth/2 + depth/2`). User may want:
- The PDU positioned **on the side rail itself** (not just near the rear corner)
- Outlets facing **outward** (currently they face inward toward rack center)
- Clearer visual distinction from the rack frame

## Files modified
- `src/components/three/DeviceModel.tsx`
- `src/components/CableViewer3D.tsx`

## Screenshots captured (cleaned up)
Verified in both 3D view and Cables 3D routing view — PDU renders at rear-left corner as tall vertical strip with orange outlets.

## Pending decision
Awaiting user confirmation if current positioning matches their expectation, or if further adjustment needed (e.g., move PDU to be truly on the side rail rather than rear corner, change outlet facing direction).
