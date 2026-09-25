# 0U PDU physical model

Current reference, reviewed 2026-09-18. [User controls](0U_PDU.zh-Hant.md) · [Architecture](dev/ARCHITECTURE.md)

0U PDUs are enabled (`ENABLE_ZERO_U_PDU = true`). They retain `sizeU: 0`; their physical length and height above base determine vertical fit rather than ordinary U occupancy. Independent side/rear mounting lanes enforce overlap and rack-height constraints.

Properties expose length, elevation, mount type, side and outlet facing. Left/right is from the front of the rack. `rackMath.ts` provides placement geometry and `rackGeometry.ts` supplies socket surfaces and cable endpoints shared by both 3D views. Do not hard-code a second rear-corner position in a renderer.

The 2D rear view shows outlets; the front indicates rear hardware. Fit includes the mounting area. The 3D camera provides Rear angle · PDU and Top inspection, and framing includes the PDU bounds. Cables follow outlet normals and preserve a downward PDU leg.

Legacy devices without physical length use a fallback of 88% of rack height and a 55 mm default depth. Set real measurements before judging fit. Mount hardware and enclosure clearances remain approximations.

Persistence and JSON retain the physical fields. If the feature flag is disabled for diagnostics, use display filtering only: keep original devices, connections and planning records in storage/export.

Relevant tests: `src/utils/zeroUPdu.test.ts`, `src/utils/rackGeometry.test.ts`, `tests/smoke/zero-u-pdu.spec.ts`. No new pass status is asserted here.
