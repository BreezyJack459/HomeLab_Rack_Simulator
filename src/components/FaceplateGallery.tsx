import { useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import type { DeviceTemplate, ViewSide } from '../types/rack';
import { getFaceplateArtifact, getFaceplateSvg, resolveFaceplateUrl } from '../utils/faceplateSvg';
import { getDeviceFaceSizeMm } from '../utils/rackMath';

const MAX_DISPLAY_WIDTH = 400;
const MIN_DISPLAY_WIDTH = 120;
// Scale faceplates by real-world width: a full 19-inch device (482.6mm)
// fills MAX_DISPLAY_WIDTH, smaller devices shrink proportionally (clamped to
// MIN_DISPLAY_WIDTH so tiny boxes like a JetKVM stay inspectable).
const FULL_RACK_WIDTH_MM = 482.6;
const PX_PER_MM = MAX_DISPLAY_WIDTH / FULL_RACK_WIDTH_MM;

export function FaceplateGallery() {
  return (
    <div className="h-full overflow-y-auto bg-surface p-6 text-slate-100">
      <h1 className="mb-2 text-2xl font-bold">Faceplate Gallery</h1>
      <p className="mb-6 text-sm text-content-faint">
        Review vendored faceplate images and procedural layouts. Front/rear faces
        are stacked so both are visible without horizontal scrolling.
      </p>
      <div className="flex flex-wrap content-start gap-6">
        {deviceCatalog
          .filter((template) => template.ports && Object.keys(template.ports).length > 0)
          .map((template) => {
            const { width } = getDeviceFaceSizeMm({
              widthType: template.widthType,
              customWidthMm: template.customWidthMm,
              sizeU: template.defaultU,
            });
            const displayWidth = Math.round(
              Math.min(
                MAX_DISPLAY_WIDTH,
                Math.max(MIN_DISPLAY_WIDTH, width * PX_PER_MM),
              ),
            );
            return (
              <div
                key={template.id}
                className="w-fit min-w-0 max-w-full rounded border border-edge-strong bg-surface-raised p-4"
              >
                <h2 className="mb-3 text-sm font-semibold">{template.name}</h2>
                <div className="flex flex-col gap-3">
                  {(['front', 'rear'] as const).map((face) => {
                    const artifact = getFaceplateArtifact(template, face);
                    const isRaster = artifact.kind === 'image';
                    return (
                      <div key={face}>
                        <div className="mb-1 text-xs uppercase text-content-faint">
                          {face} {isRaster ? '(image)' : '(generated)'}
                        </div>
                        <FaceplatePreview
                          template={template}
                          face={face}
                          displayWidth={displayWidth}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function FaceplatePreview({
  template,
  face,
  displayWidth,
}: {
  template: DeviceTemplate;
  face: ViewSide;
  displayWidth: number;
}) {
  const artifact = getFaceplateArtifact(template, face);
  const [failed, setFailed] = useState(false);

  if (artifact.kind === 'image' && !failed) {
    return (
      <img
        src={resolveFaceplateUrl(artifact.path)}
        alt={`${template.name} ${face}`}
        className="block rounded border border-edge-strong bg-black object-contain"
        style={{
          width: `${displayWidth}px`,
          maxWidth: '100%',
          height: 'auto',
        }}
        onError={() => setFailed(true)}
      />
    );
  }

  const svg = getFaceplateSvg(template, face);
  return (
    <div
      className="overflow-hidden rounded border border-edge-strong bg-black [&>svg]:block [&>svg]:h-auto [&>svg]:!w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{
        width: `${displayWidth}px`,
        maxWidth: '100%',
      }}
      aria-label={`${template.name} ${face} generated faceplate`}
    />
  );
}
