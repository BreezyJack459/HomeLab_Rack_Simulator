import type { PlacedDevice } from '../types/rack';

export interface AssetSummary {
  totalDevices: number;
  withAssetTag: number;
  withSerialNumber: number;
  withPurchaseDate: number;
  withVendor: number;
  withPurchasePrice: number;
  withWarrantyEndDate: number;
  withInvoiceRef: number;
  completeCount: number;
  incompleteCount: number;
  totalPurchaseValue: number;
  expiredWarrantyCount: number;
  expiringSoonCount: number;
}

export function summarizeAssets(devices: PlacedDevice[]): AssetSummary {
  let withAssetTag = 0;
  let withSerialNumber = 0;
  let withPurchaseDate = 0;
  let withVendor = 0;
  let withPurchasePrice = 0;
  let withWarrantyEndDate = 0;
  let withInvoiceRef = 0;
  let completeCount = 0;
  let totalPurchaseValue = 0;
  let expiredWarrantyCount = 0;
  let expiringSoonCount = 0;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const device of devices) {
    const hasAssetTag = !!device.assetTag?.trim();
    const hasSerial = !!device.serialNumber?.trim();
    const hasPurchaseDate = !!device.purchaseDate;
    const hasVendor = !!device.vendor?.trim();
    const hasPrice = device.purchasePrice != null && !Number.isNaN(device.purchasePrice);
    const hasWarranty = !!device.warrantyEndDate;
    const hasInvoice = !!device.invoiceRef?.trim();

    if (hasAssetTag) withAssetTag += 1;
    if (hasSerial) withSerialNumber += 1;
    if (hasPurchaseDate) withPurchaseDate += 1;
    if (hasVendor) withVendor += 1;
    if (hasPrice) withPurchasePrice += 1;
    if (hasWarranty) withWarrantyEndDate += 1;
    if (hasInvoice) withInvoiceRef += 1;

    if (hasAssetTag && hasSerial && hasPurchaseDate && hasVendor && hasPrice && hasWarranty) {
      completeCount += 1;
    }

    if (hasPrice) {
      totalPurchaseValue += device.purchasePrice ?? 0;
    }

    if (hasWarranty && device.warrantyEndDate) {
      const end = new Date(device.warrantyEndDate);
      if (end < now) {
        expiredWarrantyCount += 1;
      } else if (end < thirtyDaysFromNow) {
        expiringSoonCount += 1;
      }
    }
  }

  return {
    totalDevices: devices.length,
    withAssetTag,
    withSerialNumber,
    withPurchaseDate,
    withVendor,
    withPurchasePrice,
    withWarrantyEndDate,
    withInvoiceRef,
    completeCount,
    incompleteCount: devices.length - completeCount,
    totalPurchaseValue,
    expiredWarrantyCount,
    expiringSoonCount,
  };
}

export interface MissingAssetInfo {
  deviceId: string;
  deviceName: string;
  missingFields: string[];
}

export function devicesMissingAssets(devices: PlacedDevice[]): MissingAssetInfo[] {
  const result: MissingAssetInfo[] = [];

  for (const device of devices) {
    const missing: string[] = [];
    if (!device.assetTag?.trim()) missing.push('asset tag');
    if (!device.serialNumber?.trim()) missing.push('serial number');
    if (!device.purchaseDate) missing.push('purchase date');
    if (!device.vendor?.trim()) missing.push('vendor');
    if (device.purchasePrice == null || Number.isNaN(device.purchasePrice)) missing.push('purchase price');
    if (!device.warrantyEndDate) missing.push('warranty end date');

    if (missing.length > 0) {
      result.push({ deviceId: device.id, deviceName: device.name, missingFields: missing });
    }
  }

  return result;
}

function escapeCsvField(value: string | number | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportAssetRegistryCsv(devices: PlacedDevice[]): string {
  const headers = [
    'Device Name',
    'Category',
    'Asset Tag',
    'Serial Number',
    'Purchase Date',
    'Vendor',
    'Purchase Price',
    'Warranty End Date',
    'Invoice Ref',
    'Position U',
  ];

  const lines: string[] = [headers.join(',')];

  for (const device of devices) {
    const row = [
      escapeCsvField(device.name),
      escapeCsvField(device.category),
      escapeCsvField(device.assetTag),
      escapeCsvField(device.serialNumber),
      escapeCsvField(device.purchaseDate),
      escapeCsvField(device.vendor),
      escapeCsvField(device.purchasePrice),
      escapeCsvField(device.warrantyEndDate),
      escapeCsvField(device.invoiceRef),
      escapeCsvField(device.positionU),
    ];
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

export function exportAssetRegistryMarkdown(devices: PlacedDevice[]): string {
  const summary = summarizeAssets(devices);
  const lines: string[] = [
    '# Asset Registry Report',
    '',
    `**Total Devices:** ${summary.totalDevices}  `,
    `**Complete Records:** ${summary.completeCount}  `,
    `**Incomplete Records:** ${summary.incompleteCount}  `,
    `**Total Purchase Value:** $${summary.totalPurchaseValue.toFixed(2)}  `,
    `**Expired Warranties:** ${summary.expiredWarrantyCount}  `,
    `**Expiring Soon (30 days):** ${summary.expiringSoonCount}`,
    '',
    '## Device Assets',
    '',
    '| Device | Category | Asset Tag | Serial | Vendor | Price | Warranty |',
    '|--------|----------|-----------|--------|--------|-------|----------|',
  ];

  for (const device of devices) {
    const price = device.purchasePrice != null ? `$${device.purchasePrice.toFixed(2)}` : '-';
    const warranty = device.warrantyEndDate ?? '-';
    const assetTag = device.assetTag ?? '-';
    const serial = device.serialNumber ?? '-';
    const vendor = device.vendor ?? '-';
    lines.push(`| ${device.name} | ${device.category} | ${assetTag} | ${serial} | ${vendor} | ${price} | ${warranty} |`);
  }

  const missing = devicesMissingAssets(devices);
  if (missing.length > 0) {
    lines.push('', '## Missing Asset Information', '');
    for (const info of missing) {
      lines.push(`- **${info.deviceName}**: ${info.missingFields.join(', ')}`);
    }
  }

  return lines.join('\n');
}
