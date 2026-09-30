import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VisualCableConnector } from './VisualCableConnector';
import { useRackStore } from '../store/rackStore';
import { useCableWorkspaceStore } from '../store/cableWorkspaceStore';
import type { PlacedDevice, RackLayout } from '../types/rack';
const device = (id: string, category: PlacedDevice['category']): PlacedDevice => ({ id, name: id, category, sizeU: 1, positionU: id === 'Machine A' ? 1 : id === 'Panel' ? 5 : 3, widthType: '19in', depthMm: 150, color: '#334155', powerW: 10, weightKg: 1, heatLevel: 1, ports: { ethernet: 4, usb: 2, hdmi: 1 } });
const makeLayout = (): RackLayout => ({ id: 'visual-test', name: 'Test', rackType: '19in', rackDepthMm: 600, heightU: 12, weightLimitKg: 100, powerBudgetW: 1200, devices: [device('Machine A', 'server'), device('Machine B', 'server'), device('Panel', 'patch-panel')], cables: [], viewSide: 'front', updatedAt: new Date().toISOString() });
const choose = (machine: string, port: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${machine} \\d+ available`) }));
  fireEvent.click(screen.getByRole('button', { name: port }));
};
afterEach(cleanup);
beforeEach(() => {
  useRackStore.getState().loadLayout(makeLayout());
  useRackStore.setState({ selectedDeviceId: null });
  useCableWorkspaceStore.getState().requestConnection();
});
describe('visual cable workflow', () => {
  it('keeps exact endpoints while switching between socket selection and the cable view', () => {
    function ConnectorWorkspace() {
      const [showCableView, setShowCableView] = useState(false);
      return <VisualCableConnector showCableView={showCableView} onToggleCableView={() => setShowCableView(value => !value)} />;
    }
    render(<ConnectorWorkspace />);
    choose('Machine A', 'LAN 3 · rear · Available');
    fireEvent.click(screen.getByRole('button', { name: 'Show cable view' }));
    expect(screen.getByRole('button', { name: 'Back to sockets' })).toHaveAttribute('aria-pressed', 'true');
    expect(useRackStore.getState().pairingSource?.port.index).toBe(2);
    act(() => useRackStore.getState().onPortPick3D?.({ deviceId: 'Machine B', portType: 'ethernet', portIndex: 1, face: 'rear', cableTypes: [] }));
    expect(useRackStore.getState().previewCable?.toPort?.index).toBe(1);
    expect(screen.getByText(/^Destination: Machine B/)).toBeInTheDocument();
    expect(screen.getByText('Connector compatibility unverified · Review details')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to sockets' }));
    expect(screen.getByRole('heading', { name: '3 · Preview and connect' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show cable view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect cable' }));
    expect(useRackStore.getState().layout.cables[0]).toMatchObject({ fromPort: { index: 2, side: 'rear' }, toPort: { index: 1, side: 'rear' } });
  });
  it('groups unavailable source devices behind a disclosure with their reasons', () => {
    act(() => {
      useRackStore.getState().updateDevice('Panel', { ports: {} });
      useRackStore.getState().updateDevice('Machine B', { ports: { ethernet: 1 } });
      useRackStore.getState().addCable({ type: 'ethernet', color: '#fff', fromDeviceId: 'Machine A', fromPort: { type: 'ethernet', index: 0, side: 'rear' }, toDeviceId: 'Machine B', toPort: { type: 'ethernet', index: 0, side: 'rear' } });
    });
    render(<VisualCableConnector />);
    expect(screen.getByRole('button', { name: /^Machine A \d+ available/ })).toBeVisible();
    const disclosure = screen.getByText('Unavailable devices (2)').closest('details')!;
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Unavailable devices (2)'));
    disclosure.open = true;
    expect(screen.getByRole('button', { name: 'Panel No ports' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Machine B All ports in use' })).toBeDisabled();
  });
  it('allows exact numbered port selection from the larger target list', () => {
    render(<VisualCableConnector />);
    fireEvent.click(screen.getByRole('button', { name: /^Machine A \d+ available/ }));
    fireEvent.click(screen.getByRole('button', { name: 'LAN 3 · Available' }));
    fireEvent.click(screen.getByRole('button', { name: /^Machine B \d+ available/ }));
    fireEvent.focus(screen.getByRole('button', { name: 'LAN 2 · Available' }));
    expect(useRackStore.getState().previewCable?.toPort?.index).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'LAN 2 · Available' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect cable' }));
    expect(useRackStore.getState().layout.cables[0]).toMatchObject({ fromPort: { index: 2 }, toPort: { index: 1 } });
  });
  it('filters destinations by free compatible ports and opens the compatible face', () => {
    act(() => {
      useRackStore.getState().updateDevice('Panel', { ports: { ethernet: 4, usb: 0, hdmi: 0 } });
      useRackStore.getState().updateDevice('Machine B', { portFaceOverrides: { usb: 'front' } });
    });
    render(<VisualCableConnector />);
    choose('Machine A', 'USB 1 · rear · Available');
    expect(screen.queryByRole('button', { name: /^Machine A / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Panel / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Machine B \d+ available/ }));
    expect(screen.getByRole('button', { name: 'USB 1 · front · Available' })).toBeVisible();
    act(() => useRackStore.getState().updateDevice('Machine B', { ports: { ethernet: 4, usb: 0 } }));
    expect(screen.queryByRole('button', { name: /^Machine B / })).not.toBeInTheDocument();
    expect(screen.getByText('No compatible free ports. Change the source or free a port on another device.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Change source' }));
    expect(screen.getByRole('button', { name: /^Panel \d+ available/ })).toBeVisible();
  });
  it('excludes devices whose matching ports are all occupied even if other types are free', () => {
    act(() => {
      useRackStore.getState().updateDevice('Panel', { category: 'server', ports: { ethernet: 4, hdmi: 1 }, portFaceOverrides: { hdmi: 'rear' } });
      useRackStore.getState().addCable({ type: 'hdmi', color: '#fff', fromDeviceId: 'Machine B', fromPort: { type: 'hdmi', index: 0, side: 'rear' }, toDeviceId: 'Panel', toPort: { type: 'hdmi', index: 0, side: 'rear' } });
    });
    render(<VisualCableConnector />);
    choose('Machine A', 'HDMI 1 · rear · Available');
    expect(screen.queryByRole('button', { name: /^Machine B / })).not.toBeInTheDocument();
    expect(screen.getByText('No compatible free ports. Change the source or free a port on another device.')).toBeVisible();
  });
  it('previews exact diagram ports, commits only on confirmation, and survives undo/redo/reload', () => {
    render(<VisualCableConnector />);
    choose('Machine A', 'LAN 3 · rear · Available');
    choose('Machine B', 'LAN 2 · rear · Available');
    expect(useRackStore.getState().layout.cables).toHaveLength(0);
    expect(useRackStore.getState().previewCable?.fromPort?.index).toBe(2);
    fireEvent.click(screen.getByRole('button', { name: 'Connect cable' }));
    const cable = useRackStore.getState().layout.cables[0];
    expect(cable.fromPort).toEqual({ type: 'ethernet', index: 2, side: 'rear' });
    expect(cable.toPort).toEqual({ type: 'ethernet', index: 1, side: 'rear' });
    expect(screen.getByText('Cable connected. Choose the next source socket on the same device.')).toBeInTheDocument();
    act(() => useRackStore.getState().undo());
    expect(useRackStore.getState().layout.cables).toHaveLength(0);
    act(() => useRackStore.getState().redo());
    expect(useRackStore.getState().layout.cables[0].fromPort).toEqual(cable.fromPort);
    act(() => { useRackStore.getState().saveWorkspace(); useRackStore.getState().loadWorkspace(); });
    expect(useRackStore.getState().layout.cables[0].toPort).toEqual(cable.toPort);
  });
  it.each(['USB', 'HDMI'])('connects %s sockets and rejects LAN destinations', label => {
    render(<VisualCableConnector />);
    choose('Machine A', `${label} 1 · rear · Available`);
    fireEvent.click(screen.getByRole('button', { name: /^Machine B \d+ available/ }));
    expect(screen.getByRole('button', { name: 'LAN 1 · rear · Not compatible' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: `${label} 1 · rear · Available` }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect cable' }));
    expect(useRackStore.getState().layout.cables[0].type).toBe(label.toLowerCase());
  });
  it('3D hits preserve patch-panel rear face instead of matching the front jack', () => {
    render(<VisualCableConnector />);
    act(() => useRackStore.getState().onPortPick3D?.({ deviceId: 'Panel', portType: 'ethernet', portIndex: 0, face: 'rear', cableTypes: [] }));
    expect(useRackStore.getState().pairingSource?.port.side).toBe('rear');
    choose('Machine B', 'LAN 2 · rear · Available');
    fireEvent.click(screen.getByRole('button', { name: 'Connect cable' }));
    expect(useRackStore.getState().layout.cables[0]).toMatchObject({ type: 'structured', fromPort: { side: 'rear', index: 0 } });
  });
  it('backs out of preview and cancels without creating a cable or leaving a pick handler', () => {
    const view = render(<VisualCableConnector />);
    choose('Machine A', 'LAN 3 · rear · Available'); choose('Machine B', 'LAN 2 · rear · Available');
    fireEvent.click(screen.getByRole('button', { name: 'Back to destination' }));
    expect(useRackStore.getState().previewCable).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    expect(useCableWorkspaceStore.getState().connectionRequested).toBe(false);
    view.unmount();
    expect(useRackStore.getState().onPortPick3D).toBeNull();
    expect(useRackStore.getState().pairingStage).toBe('idle');
    expect(useRackStore.getState().layout.cables).toHaveLength(0);
  });
  it('refuses to commit if the selected source became occupied during review', () => {
    render(<VisualCableConnector />);
    choose('Machine A', 'LAN 3 · rear · Available'); choose('Machine B', 'LAN 2 · rear · Available');
    act(() => useRackStore.getState().addCable({ fromDeviceId: 'Machine A', fromPort: { type: 'ethernet', index: 2, side: 'rear' }, toDeviceId: 'Panel', toPort: { type: 'ethernet', index: 0, side: 'rear' }, type: 'structured', color: '#fff' }));
    expect(screen.getByRole('button', { name: 'Connect cable' })).toBeDisabled();
    expect(useRackStore.getState().layout.cables).toHaveLength(1);
  });
});
