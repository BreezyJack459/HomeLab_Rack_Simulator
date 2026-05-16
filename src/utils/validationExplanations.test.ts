import { describe, it, expect } from 'vitest';
import { explainIssue, hasExplanation } from './validationExplanations';

describe('explainIssue', () => {
  it('returns null for unknown issue ids', () => {
    expect(explainIssue('unknown-issue-123')).toBeNull();
  });

  it('returns explanation for bounds issue', () => {
    const exp = explainIssue('bounds-server-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('beyond the physical boundaries');
    expect(exp!.fixDifficulty).toBe('medium');
    expect(exp!.riskIfIgnored).toBe('critical');
  });

  it('returns explanation for overlap issue', () => {
    const exp = explainIssue('overlap-switch-02');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('same U position');
    expect(exp!.fixDifficulty).toBe('easy');
  });

  it('returns explanation for weight limit', () => {
    const exp = explainIssue('weight-limit');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('total weight');
    expect(exp!.riskIfIgnored).toBe('critical');
    expect(exp!.fixDifficulty).toBe('hard');
  });

  it('returns explanation for power limit', () => {
    const exp = explainIssue('power-limit');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('power draw');
    expect(exp!.riskIfIgnored).toBe('critical');
  });

  it('returns explanation for center of gravity', () => {
    const exp = explainIssue('center-of-gravity-high');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('center of gravity');
    expect(exp!.fixDifficulty).toBe('medium');
  });

  it('returns explanation for airflow issue', () => {
    const exp = explainIssue('airflow-server-03');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('no free U space');
    expect(exp!.fixDifficulty).toBe('easy');
  });

  it('returns explanation for heat cluster', () => {
    const exp = explainIssue('heat-cluster-a-b');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('adjacent');
    expect(exp!.riskIfIgnored).toBe('medium');
  });

  it('returns explanation for cable clutter', () => {
    const exp = explainIssue('cable-clutter');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('cable management');
  });

  it('returns explanation for missing cable device', () => {
    const exp = explainIssue('missing-cable-device');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('no longer exists');
  });

  it('returns explanation for cable short', () => {
    const exp = explainIssue('cable-short-cable-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('shorter than');
    expect(exp!.fixDifficulty).toBe('easy');
  });

  it('returns explanation for duplicate port', () => {
    const exp = explainIssue('duplicate-port-sw1:eth:0:default');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('same port');
    expect(exp!.riskIfIgnored).toBe('medium');
  });

  it('returns explanation for patch jack dark', () => {
    const exp = explainIssue('patch-jack-dark-panel-01-5');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('no rear punch-down');
  });

  it('returns explanation for endpoint-switch-direct', () => {
    const exp = explainIssue('endpoint-switch-direct-cable-02');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('directly to a switch');
    expect(exp!.fixDifficulty).toBe('medium');
  });

  it('returns explanation for speed mismatch', () => {
    const exp = explainIssue('speed-mismatch-cable-03');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('different speed');
  });

  it('returns explanation for media incompatible', () => {
    const exp = explainIssue('media-incompatible-cable-04');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('incompatible physical media');
    expect(exp!.riskIfIgnored).toBe('high');
  });

  it('returns explanation for route warnings', () => {
    expect(explainIssue('route-missing-manager-cable-05')).not.toBeNull();
    expect(explainIssue('route-power-data-separation-cable-06')).not.toBeNull();
    expect(explainIssue('route-bend-radius-risk-cable-07')).not.toBeNull();
    expect(explainIssue('route-tray-density-cable-08')).not.toBeNull();
    expect(explainIssue('route-patch-discipline-cable-09')).not.toBeNull();
    expect(explainIssue('route-pdu-side-cable-10')).not.toBeNull();
  });

  it('returns explanation for cable strain', () => {
    const exp = explainIssue('cable-strain-cable-11-device-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('too short');
  });

  it('returns explanation for front-rear collision', () => {
    const exp = explainIssue('front-rear-collision-dev1-dev2');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('overlapping depth');
    expect(exp!.fixDifficulty).toBe('hard');
  });

  it('returns explanation for heavy-over-light', () => {
    const exp = explainIssue('heavy-over-light-upper-lower');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('heavy device');
  });

  it('returns explanation for reservation bounds', () => {
    const exp = explainIssue('reservation-bounds-res-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('beyond the rack');
  });

  it('returns explanation for reservation overlap', () => {
    const exp = explainIssue('reservation-overlap-res-02-dev-03');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('reserved');
  });

  it('returns explanation for dual-psu-split', () => {
    const exp = explainIssue('dual-psu-split-server-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('same side');
    expect(exp!.riskIfIgnored).toBe('high');
  });

  it('returns explanation for redundancy', () => {
    const exp = explainIssue('redundancy-server-02');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('same electrical circuit');
  });

  it('returns explanation for depth-clear', () => {
    const exp = explainIssue('device-01-depth-clear');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('depth clearance');
  });

  it('returns explanation for strain-clear', () => {
    const exp = explainIssue('device-02-strain-clear');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('strain relief');
  });

  it('returns explanation for access-clear', () => {
    const exp = explainIssue('device-03-access-clear');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('access clearance');
  });

  it('returns explanation for collision', () => {
    const exp = explainIssue('collision-dev1-dev2');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('depth collision');
  });

  it('returns explanation for strain', () => {
    const exp = explainIssue('strain-cable-12-device-04');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('strain');
  });

  it('returns explanation for heavy', () => {
    const exp = explainIssue('heavy-upper-lower');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('heavy device');
  });

  it('returns explanation for printed-mount', () => {
    const exp = explainIssue('printed-mount-part-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('3D printed');
  });

  it('returns explanation for zone-0u', () => {
    const exp = explainIssue('zone-0u-pdu-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('not mounted on a side or rear rail');
  });

  it('returns explanation for width', () => {
    const exp = explainIssue('width-server-05');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('wider than');
  });

  it('returns explanation for depth', () => {
    const exp = explainIssue('depth-nas-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('deeper than');
  });

  it('returns explanation for ups-high', () => {
    const exp = explainIssue('ups-high-ups-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('higher than recommended');
  });

  it('returns explanation for heavy-high', () => {
    const exp = explainIssue('heavy-high-server-06');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('above the midpoint');
  });

  it('returns explanation for weight-near-limit', () => {
    const exp = explainIssue('weight-near-limit');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('over 80%');
  });

  it('returns explanation for power-near-limit', () => {
    const exp = explainIssue('power-near-limit');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('over 80%');
  });

  it('returns explanation for circuit-overload', () => {
    const exp = explainIssue('circuit-overload-A');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('circuit');
  });

  it('returns explanation for power-no-pdu', () => {
    const exp = explainIssue('power-no-pdu-cable-13');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('neither of which is a PDU');
  });

  it('returns explanation for power-front', () => {
    const exp = explainIssue('power-front-cable-14');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('front');
  });

  it('returns explanation for power-nearer-pdu', () => {
    const exp = explainIssue('power-nearer-pdu-cable-15');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('farther away');
  });

  it('returns explanation for shelf', () => {
    const exp = explainIssue('shelf-nuc-01');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('shelf component');
  });

  it('returns explanation for cable-color', () => {
    const exp = explainIssue('cable-color-cable-16');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('color convention');
  });

  it('returns explanation for patch-jack-unpatched', () => {
    const exp = explainIssue('patch-jack-unpatched-panel-02-3');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('no front patch cord');
  });

  it('returns explanation for patch-front-endpoint', () => {
    const exp = explainIssue('patch-front-endpoint-cable-17');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('front of a patch panel');
  });

  it('returns explanation for patch-rear-switch', () => {
    const exp = explainIssue('patch-rear-switch-cable-18');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('rear of a patch panel');
  });

  it('returns explanation for structured-no-panel', () => {
    const exp = explainIssue('structured-no-panel-cable-19');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('does not connect to a patch panel');
  });

  it('returns explanation for structured-front', () => {
    const exp = explainIssue('structured-front-cable-20');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('front of a patch panel');
  });

  it('returns explanation for patch-invalid-pair', () => {
    const exp = explainIssue('patch-invalid-pair-cable-21');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('other than patch-panel');
  });

  it('returns explanation for patch-rear', () => {
    const exp = explainIssue('patch-rear-cable-22');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('rear of a patch panel');
  });

  it('returns explanation for network-direct', () => {
    const exp = explainIssue('network-direct-cable-23');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('without passing through');
  });

  it('returns explanation for network-0u', () => {
    const exp = explainIssue('network-0u-cable-24');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('0U device');
    expect(exp!.riskIfIgnored).toBe('critical');
  });

  it('returns explanation for cable-media-mismatch', () => {
    const exp = explainIssue('cable-media-mismatch-cable-25');
    expect(exp).not.toBeNull();
    expect(exp!.meaning).toContain('cable type may not match');
  });
});

describe('hasExplanation', () => {
  it('returns true for known issue ids', () => {
    expect(hasExplanation('bounds-server-01')).toBe(true);
    expect(hasExplanation('power-limit')).toBe(true);
  });

  it('returns false for unknown issue ids', () => {
    expect(hasExplanation('totally-unknown-issue')).toBe(false);
  });
});
