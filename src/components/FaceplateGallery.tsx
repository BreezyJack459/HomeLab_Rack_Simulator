import { useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import type { DeviceTemplate, ViewSide } from '../types/rack';
import { getFaceplateArtifact, getFaceplateSvg } from '../utils/faceplateSvg';
import { getDeviceFaceSizeMm } from '../utils/rackMath';

const MAX_DISPLAY_WIDTH = 400;

export function FaceplateGallery() {
  return (
    <div className="h-full overflow-y-auto bg-surface p-6 text-slate-100">
      <h1 className="mb-2 text-2xl font-bold">Faceplate Gallery</h1>
      <p className="mb-6 text-sm text-content-faint">
        Review vendored faceplate images and procedural layouts. Front/rear faces
        are stacked so both are visible without horizontal scrolling.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {deviceCatalog
          .filter((template) => template.ports && Object.keys(template.ports).length > 0)
          .map((template) => {
            const { width, height } = getDeviceFaceSizeMm({
              widthType: template.widthType,
              customWidthMm: template.customWidthMm,
              sizeU: template.defaultU,
            });
            const aspectRatio = width > 0 ? width / height : 1;
            return (
              <div
                key={template.id}
                className="min-w-0 rounded border border-edge-strong bg-surface-raised p-4"
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
                          aspectRatio={aspectRatio}
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
  aspectRatio,
}: {
  template: DeviceTemplate;
  face: ViewSide;
  aspectRatio: number;
}) {
  const artifact = getFaceplateArtifact(template, face);
  const [failed, setFailed] = useState(false);

  if (artifact.kind === 'image' && !failed) {
    return (
      <img
        src={artifact.path}
        alt={`${template.name} ${face}`}
        className="block w-full max-w-full rounded border border-edge-strong bg-black object-contain"
        style={{
          maxWidth: `${MAX_DISPLAY_WIDTH}px`,
          aspectRatio,
          height: 'auto',
        }}
        onError={() => setFailed(true)}
      />
    );
  }

  const svg = getFaceplateSvg(template, face);
  return (
    <div
      className="w-full max-w-full overflow-hidden rounded border border-edge-strong bg-black [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full [&>svg]:!w-full]"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{
        maxWidth: `${MAX_DISPLAY_WIDTH}px`,
        aspectRatio,
      }}
      aria-label={`${template.name} ${face} generated faceplate`}
    />
  );
}
