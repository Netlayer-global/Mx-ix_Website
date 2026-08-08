import {
  VlanInterface,
  VirtualInterface,
  PhysicalInterface,
  SwitchPort,
  Switch,
  Vlan,
  IpAddress,
  Organization,
} from '../models';

/**
 * Switch provisioning templates — generate the CLI config a NOC engineer
 * pastes into the switch to bring a member port online.
 *
 * Supported vendors: Huawei (VRP), Cisco (IOS-XE/NX-OS), Arista (EOS).
 *
 * The generated config:
 *   - Sets the port description to "AS<N> <member-name>"
 *   - Assigns the peering VLAN (tagged/access depending on LAG)
 *   - Sets speed/duplex if applicable
 *   - Enables storm-control and port-security basics
 *   - Comments showing the allocated IP (for operator reference only)
 */

export type SwitchVendor = 'huawei' | 'cisco' | 'arista';

export interface TemplateContext {
  portName: string;
  switchName: string;
  vendor: string;
  memberName: string;
  asn: number;
  speed: number;         // Mbit/s
  vlanNumber: number;
  vlanName: string;
  ipv4?: string;
  ipv6?: string;
  lagName?: string;      // e.g. "Eth-Trunk12" / "Port-Channel12"
  lagId?: number;
  mtu?: number;
  macAddress?: string;
}

const generateHuawei = (ctx: TemplateContext): string => {
  const lines: string[] = [
    `#`,
    `# Member port config — ${ctx.memberName} (AS${ctx.asn})`,
    `# Switch: ${ctx.switchName} / Port: ${ctx.portName}`,
    `# VLAN: ${ctx.vlanNumber} (${ctx.vlanName})`,
    ctx.ipv4 ? `# IPv4: ${ctx.ipv4}` : null,
    ctx.ipv6 ? `# IPv6: ${ctx.ipv6}` : null,
    `#`,
    ``,
    `interface ${ctx.portName}`,
    ` description AS${ctx.asn} ${ctx.memberName}`,
    ` port link-type access`,
    ` port default vlan ${ctx.vlanNumber}`,
  ];

  if (ctx.mtu && ctx.mtu !== 1500) lines.push(` mtu ${ctx.mtu}`);

  lines.push(
    ` storm-control broadcast min-rate 1000 max-rate 1500`,
    ` storm-control multicast min-rate 1000 max-rate 1500`,
    ` storm-control action block`,
    ` undo shutdown`,
    `#`,
  );

  if (ctx.lagName) {
    lines.splice(lines.indexOf(` port link-type access`), 2,
      ` eth-trunk ${ctx.lagId || 0}`,
    );
    lines.push(``);
    lines.push(`interface ${ctx.lagName}`);
    lines.push(` description AS${ctx.asn} ${ctx.memberName} LAG`);
    lines.push(` port link-type access`);
    lines.push(` port default vlan ${ctx.vlanNumber}`);
    if (ctx.mtu && ctx.mtu !== 1500) lines.push(` mtu ${ctx.mtu}`);
    lines.push(` mode lacp-static`);
    lines.push(`#`);
  }

  return lines.filter((l) => l !== null).join('\n');
};

const generateCisco = (ctx: TemplateContext): string => {
  const lines: string[] = [
    `!`,
    `! Member port config — ${ctx.memberName} (AS${ctx.asn})`,
    `! Switch: ${ctx.switchName} / Port: ${ctx.portName}`,
    `! VLAN: ${ctx.vlanNumber} (${ctx.vlanName})`,
    ctx.ipv4 ? `! IPv4: ${ctx.ipv4}` : null,
    ctx.ipv6 ? `! IPv6: ${ctx.ipv6}` : null,
    `!`,
    ``,
    `interface ${ctx.portName}`,
    ` description AS${ctx.asn} ${ctx.memberName}`,
    ` switchport mode access`,
    ` switchport access vlan ${ctx.vlanNumber}`,
  ];

  if (ctx.mtu && ctx.mtu !== 1500) lines.push(` mtu ${ctx.mtu}`);

  lines.push(
    ` storm-control broadcast level 1`,
    ` storm-control multicast level 1`,
    ` spanning-tree portfast`,
    ` no shutdown`,
    `!`,
  );

  if (ctx.lagName) {
    const chId = ctx.lagId || 1;
    lines.splice(lines.indexOf(` switchport mode access`), 2,
      ` channel-group ${chId} mode active`,
    );
    lines.push(``);
    lines.push(`interface Port-Channel${chId}`);
    lines.push(` description AS${ctx.asn} ${ctx.memberName} LAG`);
    lines.push(` switchport mode access`);
    lines.push(` switchport access vlan ${ctx.vlanNumber}`);
    if (ctx.mtu && ctx.mtu !== 1500) lines.push(` mtu ${ctx.mtu}`);
    lines.push(`!`);
  }

  return lines.filter((l) => l !== null).join('\n');
};

const generateArista = (ctx: TemplateContext): string => {
  const lines: string[] = [
    `!`,
    `! Member port config — ${ctx.memberName} (AS${ctx.asn})`,
    `! Switch: ${ctx.switchName} / Port: ${ctx.portName}`,
    `! VLAN: ${ctx.vlanNumber} (${ctx.vlanName})`,
    ctx.ipv4 ? `! IPv4: ${ctx.ipv4}` : null,
    ctx.ipv6 ? `! IPv6: ${ctx.ipv6}` : null,
    `!`,
    ``,
    `interface ${ctx.portName}`,
    `   description AS${ctx.asn} ${ctx.memberName}`,
    `   switchport mode access`,
    `   switchport access vlan ${ctx.vlanNumber}`,
  ];

  if (ctx.mtu && ctx.mtu !== 1500) lines.push(`   mtu ${ctx.mtu}`);

  lines.push(
    `   storm-control broadcast level 1`,
    `   storm-control multicast level 1`,
    `   spanning-tree portfast`,
    `   no shutdown`,
    `!`,
  );

  if (ctx.lagName) {
    const chId = ctx.lagId || 1;
    lines.splice(lines.indexOf(`   switchport mode access`), 2,
      `   channel-group ${chId} mode active`,
    );
    lines.push(``);
    lines.push(`interface Port-Channel${chId}`);
    lines.push(`   description AS${ctx.asn} ${ctx.memberName} LAG`);
    lines.push(`   switchport mode access`);
    lines.push(`   switchport access vlan ${ctx.vlanNumber}`);
    if (ctx.mtu && ctx.mtu !== 1500) lines.push(`   mtu ${ctx.mtu}`);
    lines.push(`!`);
  }

  return lines.filter((l) => l !== null).join('\n');
};

const GENERATORS: Record<SwitchVendor, (ctx: TemplateContext) => string> = {
  huawei: generateHuawei,
  cisco: generateCisco,
  arista: generateArista,
};

/**
 * Generate switch port config for a member's physical interface.
 *
 * Takes a PhysicalInterface ID and produces the vendor-specific CLI config
 * that brings the port online with the correct VLAN, description and basic
 * port security. The vendor is derived from the Switch model.
 */
export const generateForPhysicalInterface = async (
  physicalInterfaceId: string,
  opts: { vendor?: SwitchVendor } = {}
): Promise<{ config: string; vendor: string; context: TemplateContext }> => {
  const pi = await PhysicalInterface.findById(physicalInterfaceId).lean();
  if (!pi) throw new Error('Physical interface not found.');

  const switchPort = await SwitchPort.findById(pi.switchPort).lean();
  if (!switchPort) throw new Error('Switch port not found.');

  const sw = await Switch.findById((switchPort as any).switch).lean();
  if (!sw) throw new Error('Switch not found.');

  const vi = await VirtualInterface.findById(pi.virtualInterface).lean();
  if (!vi) throw new Error('Virtual interface not found.');

  const org = await Organization.findById((vi as any).organization).select('name asn').lean();
  if (!org) throw new Error('Organization not found.');

  // Get the VLAN interface for addressing info
  const vli = await VlanInterface.findOne({ virtualInterface: (vi as any)._id, enabled: true })
    .populate('vlan')
    .lean();

  let ipv4: string | undefined;
  let ipv6: string | undefined;
  if (vli) {
    if ((vli as any).ipv4Address) {
      const addr = await IpAddress.findById((vli as any).ipv4Address).lean();
      if (addr) ipv4 = (addr as any).address;
    }
    if ((vli as any).ipv6Address) {
      const addr = await IpAddress.findById((vli as any).ipv6Address).lean();
      if (addr) ipv6 = (addr as any).address;
    }
  }

  const vlan = (vli as any)?.vlan;
  const vlanNumber = vlan?.number || 100;
  const vlanName = vlan?.name || 'Peering';

  // Determine vendor from the switch model or override
  const vendorMap: Record<string, SwitchVendor> = {
    Huawei: 'huawei',
    Cisco: 'cisco',
    Arista: 'arista',
    // Everything else defaults to cisco-style
  };
  const vendor: SwitchVendor = opts.vendor || vendorMap[(sw as any).vendor] || 'cisco';

  // LAG info
  let lagName: string | undefined;
  let lagId: number | undefined;
  const piCount = await PhysicalInterface.countDocuments({ virtualInterface: (vi as any)._id });
  if (piCount > 1 && (vi as any).channelGroup) {
    lagId = (vi as any).channelGroup;
    if (vendor === 'huawei') lagName = `Eth-Trunk${lagId}`;
    else lagName = `Port-Channel${lagId}`;
  }

  const ctx: TemplateContext = {
    portName: (switchPort as any).name,
    switchName: (sw as any).name,
    vendor: (sw as any).vendor,
    memberName: (org as any).name,
    asn: (org as any).asn,
    speed: pi.speed || 10000,
    vlanNumber,
    vlanName,
    ipv4,
    ipv6,
    lagName,
    lagId,
    mtu: (vi as any).mtu,
  };

  const generator = GENERATORS[vendor];
  const config = generator(ctx);

  return { config, vendor, context: ctx };
};

/**
 * Generate config for ALL physical interfaces of a connection (VirtualInterface).
 * Returns one combined config block.
 */
export const generateForConnection = async (
  virtualInterfaceId: string,
  opts: { vendor?: SwitchVendor } = {}
): Promise<{ config: string; vendor: string; portCount: number }> => {
  const pis = await PhysicalInterface.find({ virtualInterface: virtualInterfaceId }).lean();
  if (!pis.length) throw new Error('No physical interfaces found for this connection.');

  const configs: string[] = [];
  let vendor = '';
  for (const pi of pis) {
    const result = await generateForPhysicalInterface(String((pi as any)._id), opts);
    configs.push(result.config);
    vendor = result.vendor;
  }

  return {
    config: configs.join('\n\n'),
    vendor,
    portCount: pis.length,
  };
};

export default {
  generateForPhysicalInterface,
  generateForConnection,
};
