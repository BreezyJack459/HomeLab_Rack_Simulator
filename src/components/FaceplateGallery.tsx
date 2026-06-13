import { useState } from 'react';
import { deviceCatalog } from '../data/deviceCatalog';
import type { DeviceTemplate, ViewSide } from '../types/rack';
import { getFaceplateArtifact, getFaceplateSvg } from '../utils/faceplateSvg';
import { getDeviceFaceSizeMm } from '../utils/rackMath';

const DISPLAY_WIDTH = 400;

export function FaceplateGallery() {
  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 text-slate-100">
      <h1 className="mb-2 text-2xl font-bold">Faceplate Gallery</h1>
      <p className="mb-6 text-sm text-slate-400">
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
            const displayHeight = Math.max(28, DISPLAY_WIDTH * (height / width));
            return (
              <div
                key={template.id}
                className="rounded border border-slate-700 bg-slate-900 p-4"
              >
                <h2 className="mb-3 text-sm font-semibold">{template.name}</h2>
                <div className="flex flex-col gap-3">
                  {(['front', 'rear'] as const).map((face) => {
                    const artifact = getFaceplateArtifact(template, face);
                    const isRaster = artifact.kind === 'image';
                    return (
                      <div key={face}>
                        <div className="mb-1 text-xs uppercase text-slate-400">
                          {face} {isRaster ? '(image)' : '(generated)'}
                        </div>
                        <FaceplatePreview
                          template={template}
                          face={face}
                          displayHeight={displayHeight}
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
  displayHeight,
}: {
  template: DeviceTemplate;
  face: ViewSide;
  displayHeight: number;
}) {
  const artifact = getFaceplateArtifact(template, face);
  const [failed, setFailed] = useState(false);

  if (artifact.kind === 'image' && !failed) {
    return (
      <img
        src={artifact.path}
        alt={`${template.name} ${face}`}
        className="border border-slate-700 bg-black object-contain"
        style={{ width: DISPLAY_WIDTH, height: displayHeight }}
        onError={() => setFailed(true)}
      />
    );
  }

  const svg = getFaceplateSvg(template, face);
  return (
    <div
      className="border border-slate-700 bg-black"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ width: DISPLAY_WIDTH, height: displayHeight }}
      aria-label={`${template.name} ${face} generated faceplate`}
    />
  );
}
