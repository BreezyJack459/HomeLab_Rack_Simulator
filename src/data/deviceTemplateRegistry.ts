import type { DeviceTemplate } from '../types/rack';

// The store needs lookup only. The lazy library/editor modules register the
// catalog before exposing template-based placement, keeping data out of startup.
const templates = new Map<string, DeviceTemplate>();

export const registerDeviceTemplates = (catalog: readonly DeviceTemplate[]): void => {
  templates.clear();
  for (const template of catalog) templates.set(template.id, template);
};

export const getTemplateById = (id: string | undefined): DeviceTemplate | undefined =>
  id ? templates.get(id) : undefined;
