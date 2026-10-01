import { tidyPanelCables } from './panelCableTidy';
import type { RackLayout } from '../types/rack';
export const tidyPanelRoutes = (layout: RackLayout, panelId: string) => { const result = tidyPanelCables(layout, panelId); return { ...result, manual: result.manualKept }; };
