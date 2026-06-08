export interface ValidationExplanation {
  meaning: string;
  whyItMatters: string;
  realWorldSymptom: string;
  fixDifficulty: 'easy' | 'medium' | 'hard';
  riskIfIgnored: 'low' | 'medium' | 'high' | 'critical';
  whenAcceptableToIgnore: string;
}

type Matcher = (id: string) => ValidationExplanation | null;

const matchers: Matcher[] = [
  // Rack bounds / placement
  (id) =>
    id.startsWith('bounds-')
      ? {
          meaning: 'A device extends beyond the physical boundaries of the rack.',
          whyItMatters:
            "Racks have fixed height (U count), width, and depth. A device that doesn't fit cannot be physically installed.",
          realWorldSymptom:
            'You receive the hardware and discover it sticks out the back, hangs too low, or is too wide for the rack posts.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'critical',
          whenAcceptableToIgnore: 'Never — this is a hard physical constraint.',
        }
      : null,

  (id) =>
    id.startsWith('zone-0u-')
      ? {
          meaning: 'A 0U device (usually a vertical PDU) is not mounted on a side or rear rail zone.',
          whyItMatters:
            '0U devices mount on the rack frame or accessory rails, not in standard U slots. They need a designated zone to avoid colliding with rack-mounted gear.',
          realWorldSymptom: 'The PDU bracket conflicts with a server or shelf you planned in the same U space.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'Never — 0U devices must use rail/rear zones.',
        }
      : null,

  (id) =>
    id.startsWith('overlap-')
      ? {
          meaning: 'Two devices occupy the same U position or horizontal footprint.',
          whyItMatters: 'Rack space is discrete. Two objects cannot occupy the same physical volume.',
          realWorldSymptom: 'You go to install the second device and there is no room; or you discover one blocks the airflow of the other.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'critical',
          whenAcceptableToIgnore:
            'During early planning when devices are deliberately overlapping before final placement. Mark them as "planned" to reduce severity.',
        }
      : null,

  (id) =>
    id.startsWith('width-')
      ? {
          meaning: 'A device is wider than the usable internal width of the rack.',
          whyItMatters: 'Rack posts and rails define a fixed opening. A device too wide will not slide in or mount flush.',
          realWorldSymptom: 'The server chassis ears do not reach the rack posts, or the device protrudes from the front.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'critical',
          whenAcceptableToIgnore: 'Never — unless the rack spec in the tool is conservative and the real rack is wider.',
        }
      : null,

  (id) =>
    id.startsWith('depth-')
      ? {
          meaning: 'A device is deeper than the usable rack depth after cable and door clearances.',
          whyItMatters:
            'Rear doors, cable bend radius, and power plug depth all consume space. A device too deep will prevent door closure or strain cables.',
          realWorldSymptom: 'The rear door cannot close, or power cables are pinched at a sharp angle.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore:
            'If you plan to leave the rear door open or use a shallow power plug. Update rack depth config to match reality.',
        }
      : null,

  // Weight & stability
  (id) =>
    id === 'weight-limit'
      ? {
          meaning: 'The total weight of all devices exceeds the rack load rating.',
          whyItMatters: 'Floor-loading, caster limits, and rail shear strength all depend on staying within rated weight.',
          realWorldSymptom:
            'Rack casters collapse, rails bend, or the floor joists sag. In severe cases the rack tips when a heavy drawer is opened.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'critical',
          whenAcceptableToIgnore: 'Never — unless the rack is on a reinforced concrete slab and you have verified static load exceeds rating.',
        }
      : null,

  (id) =>
    id === 'weight-near-limit'
      ? {
          meaning: 'Total rack weight is over 80% of the rated limit.',
          whyItMatters: 'Leaving headroom allows for future additions, cable weight, and safety margin.',
          realWorldSymptom: 'You add one more NAS or UPS and suddenly exceed the limit; or casters groan when rolling the rack.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'If the rack is bolted to the floor and will not grow further.',
        }
      : null,

  (id) =>
    id.startsWith('ups-high-')
      ? {
          meaning: 'A UPS is mounted higher than recommended in the rack.',
          whyItMatters: 'UPS units are heavy and contain lead-acid or lithium batteries. High mounting raises the center of gravity.',
          realWorldSymptom: 'The rack becomes top-heavy and may tip during maintenance or earthquakes.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore:
            'If the rack is wall-mounted or bolted, and the UPS weight is modest (<10kg). Still not ideal.',
        }
      : null,

  (id) =>
    id.startsWith('heavy-high-')
      ? {
          meaning: 'A heavy device (8kg+) is mounted above the midpoint of the rack.',
          whyItMatters: 'Heavy gear high in the rack raises the center of gravity, increasing tip risk and rail load.',
          realWorldSymptom: 'Rack feels unstable when slid out on casters; rails sag or flex.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If the rack is fixed in place and the total weight is well under limit.',
        }
      : null,

  (id) =>
    id === 'center-of-gravity-high'
      ? {
          meaning: 'The calculated center of gravity of all rack contents is above 60% of rack height.',
          whyItMatters:
            'A high center of gravity makes the rack prone to tipping, especially on casters or during maintenance.',
          realWorldSymptom: 'Rack wobbles when you pull out a server on rails; caster locks strain under static load.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore:
            'Wall-mounted racks or racks bolted to concrete floors with anti-tip brackets.',
        }
      : null,

  // Thermal / airflow
  (id) =>
    id.startsWith('airflow-')
      ? {
          meaning: 'A high-heat device has no free U space immediately above or below it.',
          whyItMatters:
            'Hot devices need airflow gaps to prevent thermal stacking. Adjacent gear traps heat and reduces cooling efficiency.',
          realWorldSymptom: 'Devices thermal-throttle, fans run at 100%, or drives exceed safe operating temperature.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'If the device is fanless and low-wattage, or if the rack has dedicated front-to-rear airflow with blanking panels.',
        }
      : null,

  (id) =>
    id.startsWith('heat-cluster-')
      ? {
          meaning: 'Two or more high-heat devices are positioned adjacent to each other.',
          whyItMatters: 'Heat compounds. Two hot devices next to each other create a local hotspot that exceeds ambient cooling.',
          realWorldSymptom:
            'Upper device in the cluster runs 10-20C hotter than lower device; both fans spin up under load.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'If both devices are low-utilization and the room has strong ambient cooling or dedicated exhaust.',
        }
      : null,

  // Power
  (id) =>
    id === 'power-limit'
      ? {
          meaning: 'Total power draw of all devices exceeds the configured power budget.',
          whyItMatters: 'Circuit breakers trip, PDUs overload, or UPS runtime collapses to seconds.',
          realWorldSymptom: 'Breaker trips when all devices power on simultaneously; UPS alarms under load.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'critical',
          whenAcceptableToIgnore: 'Never — unless the power budget is intentionally conservative and the real circuit is larger.',
        }
      : null,

  (id) =>
    id === 'power-near-limit'
      ? {
          meaning: 'Total power draw is over 80% of the configured budget.',
          whyItMatters: 'Inrush current at boot can briefly exceed steady-state draw. 80% headroom prevents nuisance trips.',
          realWorldSymptom: 'Everything works fine until you reboot the rack, then the breaker trips during spin-up.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'If devices are staggered-boot or soft-start, and the power budget reflects continuous draw rather than peak.',
        }
      : null,

  (id) =>
    id.startsWith('circuit-overload-')
      ? {
          meaning: 'A power circuit is loaded above 80% of its source capacity.',
          whyItMatters: 'Breakers are rated for continuous load at 80% of nominal. Above that, thermal trip risk increases.',
          realWorldSymptom: 'Circuit breaker trips after sustained load, especially in warm weather.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore:
            'If the circuit is derated in the tool but the real breaker is higher capacity, or if loads are non-simultaneous.',
        }
      : null,

  (id) =>
    id.startsWith('dual-psu-split-')
      ? {
          meaning: 'A dual-PSU server has both power cables going to PDUs on the same side of the rack.',
          whyItMatters:
            'Dual PSUs exist for redundancy. If one PDU or side fails, both PSUs lose power if they share the same feed.',
          realWorldSymptom: 'A single PDU failure takes down the server despite having two PSUs.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If the two PDUs are on separate circuits even though on the same side.',
        }
      : null,

  (id) =>
    id.startsWith('redundancy-')
      ? {
          meaning: 'Redundant power feeds for a device trace back to the same electrical circuit.',
          whyItMatters:
            'True redundancy requires independent circuits. Same-circuit redundancy only protects against PDU failure, not breaker or upstream loss.',
          realWorldSymptom: 'The circuit breaker trips and every device with "redundant" power goes down simultaneously.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If you only have one circuit available and accept single-point-of-failure.',
        }
      : null,

  (id) =>
    id.startsWith('power-no-pdu-')
      ? {
          meaning: 'A power cable connects two devices, neither of which is a PDU.',
          whyItMatters: 'Power distribution should flow through PDUs for circuit protection, monitoring, and organization.',
          realWorldSymptom: 'You daisy-chain power strips or use wall warts scattered around the rack — unsafe and unmonitored.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'Small low-power devices (Pi, NUC) powered by USB or individual wall adapters in a non-PDU setup.',
        }
      : null,

  (id) =>
    id.startsWith('power-front-')
      ? {
          meaning: 'A power cable runs from the front of a device rather than the rear.',
          whyItMatters: 'Rear power entry keeps front accessible and routes cables toward rear-mounted PDUs cleanly.',
          realWorldSymptom: 'Power cables snake around the front of the rack, blocking server removal and looking messy.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore:
            'Some devices (short-depth NUCs, appliances) only have front power inlets. Use a short extension to route toward the rear.',
        }
      : null,

  (id) =>
    id.startsWith('power-nearer-pdu-')
      ? {
          meaning: 'A device is connected to a PDU that is farther away than the nearest available PDU.',
          whyItMatters: 'Shorter power runs reduce cable clutter, voltage drop, and cost.',
          realWorldSymptom: 'A 2m power cable stretched across the rack when a 0.5m cable to the nearer PDU would suffice.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore:
            'When balancing load across PDUs intentionally, or when the nearer PDU has no free outlets.',
        }
      : null,

  // Shelf support
  (id) =>
    id.startsWith('shelf-')
      ? {
          meaning: 'A shelf-mounted device does not have a nearby shelf component for support.',
          whyItMatters: 'Non-rackmount gear (towers, NUCs, external drives) needs a physical shelf or tray to rest on.',
          realWorldSymptom: 'The device sits precariously on top of another device, or falls behind the rails.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If the device is actually rail-mounted but mis-tagged as shelf type.',
        }
      : null,

  // Cables
  (id) =>
    id === 'cable-clutter'
      ? {
          meaning: 'The rack has many more cables than devices, suggesting poor cable management.',
          whyItMatters: 'Dense cable runs block airflow, make tracing hard, and increase bend-radius risk.',
          realWorldSymptom: 'You cannot identify which cable goes where without unplugging things; airflow is visibly blocked.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'Patch-heavy setups (many switch-to-patch-panel runs) naturally have high cable counts. Use cable managers.',
        }
      : null,

  (id) =>
    id === 'missing-cable-device'
      ? {
          meaning: 'A cable route references a device that no longer exists in the layout.',
          whyItMatters: 'Stale cables clutter the plan and mislead during maintenance or audits.',
          realWorldSymptom: 'You trace a cable in the tool to a device that was removed months ago.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Never — stale cables should always be cleaned up.',
        }
      : null,

  (id) =>
    id.startsWith('cable-short-')
      ? {
          meaning: 'A manually-specified cable length is shorter than the geometric path plus slack budget.',
          whyItMatters: 'Cables need service loops for device pull-out and bend radius. A cable exactly long enough to reach is too short to maintain.',
          realWorldSymptom: 'You pull a server out on rails and the cable yanks taut, or you cannot close the cable tray lid.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'Temporary lab cables, or when the geometric path already includes generous slack in the measurement.',
        }
      : null,

  (id) =>
    id.startsWith('cable-color-')
      ? {
          meaning: 'A cable color deviates from the standard color convention for its type.',
          whyItMatters: 'Consistent cable colors make tracing and troubleshooting faster for you and anyone else who touches the rack.',
          realWorldSymptom: 'You spend 10 minutes tracing a power cable that looks identical to a data cable.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'When you have run out of the correct color and will reorder, or in a single-person lab where you know every cable.',
        }
      : null,

  (id) =>
    id.startsWith('duplicate-port-')
      ? {
          meaning: 'Two cables claim the same port on a device.',
          whyItMatters: 'A physical port can only accept one cable. Two routes to the same port is a planning error.',
          realWorldSymptom: 'You install the second cable and discover the port is already occupied; or the switch does not link up.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Never — this indicates a planning conflict that must be resolved.',
        }
      : null,

  // Patch panel discipline
  (id) =>
    id.startsWith('patch-jack-dark-')
      ? {
          meaning: 'A patch panel front port is patched to a switch but has no rear punch-down (home run).',
          whyItMatters: 'Patch panels bridge structured cabling (rear) to patch cords (front). A dark jack is a dead port.',
          realWorldSymptom: 'The switch shows no link on that port; tracing the cable reveals nothing connected in the wall.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'If the jack is reserved for future use and intentionally not punched down yet.',
        }
      : null,

  (id) =>
    id.startsWith('patch-jack-unpatched-')
      ? {
          meaning: 'A patch panel jack has a rear home run but no front patch cord to a switch.',
          whyItMatters: 'The room port is live but not connected to the network. Users in that room have no Ethernet.',
          realWorldSymptom: 'A user plugs into the wall jack and gets no link light; the switch port is empty.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'If the room port is intentionally disconnected or the room is unoccupied.',
        }
      : null,

  (id) =>
    id.startsWith('endpoint-switch-direct-')
      ? {
          meaning: 'An endpoint device is connected directly to a switch, bypassing the patch panel.',
          whyItMatters:
            'Structured cabling discipline requires endpoint → patch panel → switch. Direct connections are hard to trace and reconfigure.',
          realWorldSymptom: 'You move the switch and must re-run every endpoint cable; labels do not match wall plate numbers.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore:
            'Temporary lab links, management ports, or out-of-band connections that do not need wall-plate mapping.',
        }
      : null,

  (id) =>
    id.startsWith('patch-front-endpoint-')
      ? {
          meaning: 'An endpoint device is connected to the front of a patch panel instead of the rear.',
          whyItMatters: 'Patch panel front ports are for switch patch cords; rear ports are for structured endpoint runs.',
          realWorldSymptom: 'The endpoint cable is too short to reach the switch, or the wall plate mapping is backwards.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Never — this breaks structured cabling discipline.',
        }
      : null,

  (id) =>
    id.startsWith('patch-rear-switch-')
      ? {
          meaning: 'A switch is connected to the rear of a patch panel instead of the front.',
          whyItMatters: 'Switches patch to the front of panels; endpoints home-run to the rear. Reversing this breaks cable management.',
          realWorldSymptom: 'Switch patch cords are too long and must snake around to the rear of the panel; tracing is confusing.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Never — this breaks structured cabling discipline.',
        }
      : null,

  (id) =>
    id.startsWith('structured-no-panel-')
      ? {
          meaning: 'A structured cable does not connect to a patch panel.',
          whyItMatters: 'Structured cables are the permanent in-wall infrastructure; they must terminate on patch panels.',
          realWorldSymptom: 'You have a raw cable end flapping in the rack with no keystone or punch-down point.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'Never — structured cables without panels are unmanageable.',
        }
      : null,

  (id) =>
    id.startsWith('structured-front-')
      ? {
          meaning: 'A structured cable is landed on the front of a patch panel.',
          whyItMatters: 'Structured cables terminate on the rear of panels. The front is reserved for removable patch cords.',
          realWorldSymptom: 'The keystone jack on the front is stressed by a stiff in-wall cable; it will fail over time.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Never — re-punch to the rear.',
        }
      : null,

  (id) =>
    id.startsWith('patch-invalid-pair-')
      ? {
          meaning: 'A patch cable connects devices other than patch-panel ↔ switch.',
          whyItMatters: 'Patch cables are short, flexible jumpers between panels and switches. Using them elsewhere invites length and type mismatches.',
          realWorldSymptom: 'A 0.5m patch cable stretched between two distant devices, or a power cable mis-tagged as patch.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Temporary test cables in a lab environment.',
        }
      : null,

  (id) =>
    id.startsWith('patch-rear-')
      ? {
          meaning: 'A patch cable is plugged into the rear of a patch panel.',
          whyItMatters: 'Rear ports are for structured home runs. Patch cords go on the front for easy moves, adds, and changes.',
          realWorldSymptom: 'You need to change a switch port mapping but must reach behind the panel where cables are bundled.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Temporary testing or very short rack depths where front/rear distinction is minor.',
        }
      : null,

  (id) =>
    id.startsWith('network-direct-')
      ? {
          meaning: 'A network cable connects two devices without passing through a patch panel.',
          whyItMatters: 'Patch panels provide a flexible demarcation point. Direct runs are harder to reconfigure and trace.',
          realWorldSymptom: 'Moving a switch requires re-running every cable directly connected to it.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Management ports, out-of-band links, or small labs with no structured cabling.',
        }
      : null,

  (id) =>
    id.startsWith('network-0u-')
      ? {
          meaning: 'A network cable is connected to a 0U device.',
          whyItMatters: '0U devices are typically vertical PDUs or cable managers. They do not have Ethernet ports.',
          realWorldSymptom: 'You try to plug an RJ45 into a PDU power outlet — physically impossible.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'critical',
          whenAcceptableToIgnore: 'Never — this is a data-model error.',
        }
      : null,

  // Port speed / media
  (id) =>
    id.startsWith('speed-mismatch-')
      ? {
          meaning: 'Two connected ports have different speed ratings (e.g., 1G ↔ 10G).',
          whyItMatters: 'The link will negotiate to the lower speed. You may not get the performance you expect.',
          realWorldSymptom: 'A 10G NAS connected to a 1G switch only transfers at 100 MB/s.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore:
            'When intentionally downgrading (e.g., 10G device on 1G management network) or when the faster port is for future upgrade.',
        }
      : null,

  (id) =>
    id.startsWith('media-incompatible-')
      ? {
          meaning: 'Two connected ports use incompatible physical media (e.g., RJ45 ↔ fiber).',
          whyItMatters: 'Different media types need transceivers or adapters. A direct cable will not fit or link.',
          realWorldSymptom: 'You have an RJ45 cable and an SFP+ port — the connector does not fit.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'Never — unless you already have the correct transceiver/adapter and it is just not modeled.',
        }
      : null,

  (id) =>
    id.startsWith('cable-media-mismatch-')
      ? {
          meaning: 'The cable type may not match the port media type.',
          whyItMatters: 'Using a fiber cable on an RJ45 port (or vice versa) requires a media converter or transceiver.',
          realWorldSymptom: 'No link light; the cable connector does not fit the port.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'When a transceiver is planned but not yet modeled in the tool.',
        }
      : null,

  // Routing warnings
  (id) =>
    id.startsWith('route-missing-manager-')
      ? {
          meaning: 'A cable run passes through an area where a cable manager would help organization.',
          whyItMatters: 'Cable managers reduce strain, improve airflow, and make tracing easier.',
          realWorldSymptom: 'Cables dangle loosely between devices, catching on rails and blocking server removal.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Short lab cables in a temporary setup.',
        }
      : null,

  (id) =>
    id.startsWith('route-power-data-separation-')
      ? {
          meaning: 'Power and data cables share the same cable tray or path.',
          whyItMatters: 'Separating power and data reduces EMI, simplifies tracing, and improves safety.',
          realWorldSymptom: 'Ethernet links occasionally drop when a high-draw device powers on (EMI coupling).',
          fixDifficulty: 'medium',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Small racks where physical separation is impractical; use shielded cables instead.',
        }
      : null,

  (id) =>
    id.startsWith('route-bend-radius-risk-')
      ? {
          meaning: 'A cable route has a tight bend that may exceed safe bend radius.',
          whyItMatters: 'Tight bends damage cable jackets and alter impedance, causing signal loss or intermittent faults.',
          realWorldSymptom: 'A fiber link drops under vibration; a copper link shows CRC errors.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Very short patch cords where the bend is naturally large-radius due to slack.',
        }
      : null,

  (id) =>
    id.startsWith('route-tray-density-')
      ? {
          meaning: 'A cable tray or management zone has many cables routed through it.',
          whyItMatters: 'Overfilled trays block airflow, make adds/moves/changes hard, and risk exceeding fill ratio.',
          realWorldSymptom: 'You cannot slide a new cable into the tray without removing existing bundles.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'If the tray is larger than modeled or if you plan to add a second tray soon.',
        }
      : null,

  (id) =>
    id.startsWith('route-patch-discipline-')
      ? {
          meaning: 'A patch cable route violates structured cabling discipline.',
          whyItMatters: 'Patch cables should be short, neat, and front-facing. Long or rear patch runs break the separation of permanent and flexible infrastructure.',
          realWorldSymptom: 'A 3m patch cable looped around the rack because the switch and panel are far apart.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Temporary testing or relocated gear awaiting permanent re-cabling.',
        }
      : null,

  (id) =>
    id.startsWith('route-pdu-side-')
      ? {
          meaning: 'A power route does not pass through the PDU side of the rack.',
          whyItMatters: 'Power cables should drop vertically near the PDU then route to devices, keeping them organized and short.',
          realWorldSymptom: 'Power cables stretch diagonally across the rack, crossing data cables and blocking airflow.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'If the PDU is centrally mounted and the device is directly opposite.',
        }
      : null,

  // Serviceability
  (id) =>
    id.startsWith('cable-strain-')
      ? {
          meaning: 'A cable is too short to allow the connected device to be pulled out for service.',
          whyItMatters: 'Servicing a device on pull-out rails requires slack so cables stay connected during maintenance.',
          realWorldSymptom: 'You pull a server out and cables yank taut, forcing you to power down to access internals.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Devices that are never serviced on rails (fixed-mount gear).',
        }
      : null,

  (id) =>
    id.startsWith('front-rear-collision-')
      ? {
          meaning: 'A front-mounted and rear-mounted device occupy overlapping depth space.',
          whyItMatters: 'Front and rear devices share the same rack depth. Deep front gear can block rear gear from fitting.',
          realWorldSymptom: 'The rear door cannot close because a deep front server leaves no room for the rear-mounted PDU.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If one device is shallow enough that the combined depth is within rack limits.',
        }
      : null,

  (id) =>
    id.startsWith('heavy-over-light-')
      ? {
          meaning: 'A heavy device is mounted directly above a lighter device with little clearance.',
          whyItMatters: 'If the upper device sags or the rail fails, it falls onto the lower device. Service access is also harder.',
          realWorldSymptom: 'You remove the upper device and the lower device is in the way; or the lower device is damaged by falling hardware.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'If both are firmly rail-mounted with adequate gap and the lower device is a shelf, not electronics.',
        }
      : null,

  // Reservations
  (id) =>
    id.startsWith('reservation-bounds-')
      ? {
          meaning: 'A reserved U range extends beyond the rack height.',
          whyItMatters: 'Reservations are planning placeholders. An out-of-bounds reservation is meaningless.',
          realWorldSymptom: 'You reserved U space that does not exist in the physical rack.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'Never — fix the reservation range.',
        }
      : null,

  (id) =>
    id.startsWith('reservation-overlap-')
      ? {
          meaning: 'A device occupies U space that was reserved for future hardware.',
          whyItMatters: 'Reservations exist to prevent accidental conflicts. Overlapping them defeats the purpose.',
          realWorldSymptom: 'You install a new device in reserved space and have to move it later when the reserved gear arrives.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'low',
          whenAcceptableToIgnore: 'If the reservation is obsolete and should be deleted.',
        }
      : null,

  // Depth / clearance (printed mount / fit-check related)
  (id) =>
    id.endsWith('-depth-clear')
      ? {
          meaning: 'A device has inadequate depth clearance for its rails or rear cables.',
          whyItMatters: 'Devices need clearance behind them for cable bend radius, power plugs, and rear-mounted accessories.',
          realWorldSymptom: 'Power cables are pinched against the rear door; rails cannot fully extend.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If the rack has no rear door and cables are routed to the side.',
        }
      : null,

  (id) =>
    id.endsWith('-strain-clear')
      ? {
          meaning: 'A device has inadequate strain relief or cable slack clearance.',
          whyItMatters: 'Cables need slack loops so they are not under tension when the device is in normal position.',
          realWorldSymptom: 'Cable connectors slowly work loose due to constant tension; intermittent network drops.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Fixed-mount devices that are never moved.',
        }
      : null,

  (id) =>
    id.endsWith('-access-clear')
      ? {
          meaning: 'A device has inadequate front or rear access clearance for maintenance.',
          whyItMatters: 'Technicians need space to remove covers, swap drives, and inspect LEDs without removing neighbors.',
          realWorldSymptom: 'You cannot open a server lid without unscrewing the device above it.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Very shallow devices (1U switch) where access is from the front panel only.',
        }
      : null,

  (id) =>
    id.startsWith('collision-')
      ? {
          meaning: 'Two devices have a physical depth collision when both are mounted.',
          whyItMatters: 'Combined front and rear device depths may exceed rack internal depth.',
          realWorldSymptom: 'Both devices cannot be fully inserted; one sticks out or presses against the other.',
          fixDifficulty: 'hard',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If one device is mounted on sliding rails that pull it forward, creating dynamic clearance.',
        }
      : null,

  (id) =>
    id.startsWith('strain-')
      ? {
          meaning: 'A cable creates strain on a specific device port.',
          whyItMatters: 'Strained ports suffer mechanical fatigue and can crack solder joints or damage the jack.',
          realWorldSymptom: 'The Ethernet port feels loose; wiggling the cable restores link.',
          fixDifficulty: 'easy',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'Temporary connections or when a service loop is planned but not yet installed.',
        }
      : null,

  (id) =>
    id.startsWith('heavy-')
      ? {
          meaning: 'A heavy device is positioned above another in a way that risks service access.',
          whyItMatters: 'Heavy devices are harder to lift and position. Having one above another complicates maintenance.',
          realWorldSymptom: 'You need two people to safely remove the upper device without dropping it on the lower one.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'medium',
          whenAcceptableToIgnore: 'If both are on robust sliding rails with adequate inter-unit clearance.',
        }
      : null,

  // Printed mount / fit check
  (id) =>
    id.startsWith('printed-mount-')
      ? {
          meaning: 'A 3D printed mount or accessory conflicts with rack geometry or neighboring devices.',
          whyItMatters: 'Printed parts have physical volume. If they collide with devices, rails, or doors, the design is unprintable or unmountable.',
          realWorldSymptom: 'You print the part and discover it hits a shelf bracket or prevents the rear door from closing.',
          fixDifficulty: 'medium',
          riskIfIgnored: 'high',
          whenAcceptableToIgnore: 'If the collision is with a component you plan to remove before installing the printed part.',
        }
      : null,
];

export function explainIssue(id: string): ValidationExplanation | null {
  for (const matcher of matchers) {
    const result = matcher(id);
    if (result) return result;
  }
  return null;
}

export function hasExplanation(id: string): boolean {
  return explainIssue(id) !== null;
}
