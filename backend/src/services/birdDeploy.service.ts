import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { Types } from 'mongoose';
import { RouteServer, BirdDeployment } from '../models';
import { IRouteServer } from '../models/routeServer.model';
import { buildConfig } from './birdConfig.service';
import { logAudit } from './audit.service';

/**
 * Pushes generated BIRD config to the route servers.
 *
 * Each BIRD runs on its own host (1 daemon per server, 2 servers per location),
 * so every deploy targets exactly one machine. Three transports:
 *
 *   local  — BIRD on the same host as this backend (lab / all-in-one)
 *   ssh    — the normal production case; OpenSSH client, key auth
 *   agent  — a small HTTPS service on the BIRD host; best when SSH from the
 *            web tier is not acceptable, and the only way to run a bespoke
 *            reload script (which then lives on the BIRD host, not in our DB)
 *
 * ## Command-injection posture
 *
 * Every external command runs through `execFile` with an **argv array**, so no
 * shell is involved and no value can break out into a new command. The only
 * operator-supplied values that reach a command line are the socket path, the
 * systemd unit, the SSH host/user/key and the config path — each validated
 * against a strict allow-list pattern below. There is deliberately no
 * free-text "reload command" field: that would make editing a route server
 * equivalent to remote code execution.
 */

const execFileAsync = (
  file: string,
  args: string[],
  opts: { timeout?: number; input?: string } = {}
): Promise<{ stdout: string; stderr: string; code: number }> =>
  new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { timeout: opts.timeout ?? 30000, maxBuffer: 4 * 1024 * 1024 },
      (err: any, stdout, stderr) => {
        resolve({
          stdout: String(stdout || ''),
          stderr: String(stderr || err?.message || ''),
          code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        });
      }
    );
    if (opts.input !== undefined && child.stdin) {
      child.stdin.end(opts.input);
    }
  });

// ── Validation of operator-supplied values that reach a command line ──

/** Absolute POSIX path, no shell metacharacters, no traversal. */
const SAFE_PATH = /^\/[A-Za-z0-9._\-\/]+$/;
/** Hostname, IPv4 or IPv6 literal. */
const SAFE_HOST = /^[A-Za-z0-9._\-:]+$/;
const SAFE_USER = /^[A-Za-z0-9._-]+$/;
const SAFE_UNIT = /^[A-Za-z0-9._@-]+$/;

const assertSafe = (value: string, pattern: RegExp, label: string): string => {
  const v = String(value || '').trim();
  if (!v) throw new Error(`${label} is not set.`);
  if (!pattern.test(v)) throw new Error(`${label} contains characters that are not allowed: ${v}`);
  if (v.includes('..')) throw new Error(`${label} must not contain "..".`);
  return v;
};

// ── Command construction ──

const withSudo = (rs: IRouteServer, file: string, args: string[]): { file: string; args: string[] } =>
  rs.useSudo ? { file: 'sudo', args: ['-n', file, ...args] } : { file, args };

/** `birdc -s <socket> configure check <file>` — parses without applying. */
const validateArgv = (rs: IRouteServer, configPath: string): { file: string; args: string[] } => {
  const socket = assertSafe(rs.birdSocket || '', SAFE_PATH, 'BIRD control socket');
  return withSudo(rs, 'birdc', ['-s', socket, 'configure', 'check', configPath]);
};

const reloadArgv = (rs: IRouteServer): { file: string; args: string[] } => {
  if (rs.reloadStrategy === 'systemctl') {
    const unit = assertSafe(rs.systemdUnit || '', SAFE_UNIT, 'systemd unit');
    return withSudo(rs, 'systemctl', ['reload', unit]);
  }
  const socket = assertSafe(rs.birdSocket || '', SAFE_PATH, 'BIRD control socket');
  return withSudo(rs, 'birdc', ['-s', socket, 'configure']);
};

/** Wrap a local argv into an SSH invocation of the same command. */
const sshArgv = (rs: IRouteServer, remote: { file: string; args: string[] }): { file: string; args: string[] } => {
  const host = assertSafe(rs.sshHost || '', SAFE_HOST, 'SSH host');
  const user = rs.sshUser ? assertSafe(rs.sshUser, SAFE_USER, 'SSH user') : '';
  const port = Number(rs.sshPort || 22);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SSH port is invalid.');

  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=10',
    '-p', String(port),
  ];
  if (rs.sshKeyPath) {
    args.push('-i', assertSafe(rs.sshKeyPath, SAFE_PATH, 'SSH key path'));
  }
  args.push(user ? `${user}@${host}` : host);
  // The remote side runs this through a shell, so each argument is quoted. All
  // values are already allow-list validated above.
  args.push([remote.file, ...remote.args].map((a) => `'${String(a).replace(/'/g, `'\\''`)}'`).join(' '));
  return { file: 'ssh', args };
};

// ── Transports ──

export interface DeployTransportResult {
  ok: boolean;
  output: string;
  error?: string;
  previousConfig?: string;
}

const truncate = (s: string, n = 4000): string => (s.length > n ? `${s.slice(0, n)}\n… (truncated)` : s);

/** Write + validate + reload on the same host as this backend. */
const deployLocal = async (rs: IRouteServer, config: string): Promise<DeployTransportResult> => {
  const configPath = assertSafe(rs.configPath || '', SAFE_PATH, 'Config path');
  const log: string[] = [];

  const previousConfig = await fs.readFile(configPath, 'utf-8').catch(() => '');

  // Stage next to the target so the final move is atomic on the same filesystem.
  const staged = `${configPath}.mxix-new`;
  await fs.writeFile(staged, config, { encoding: 'utf-8', mode: 0o640 });

  const v = validateArgv(rs, staged);
  const validate = await execFileAsync(v.file, v.args);
  log.push(`$ ${v.file} ${v.args.join(' ')}\n${validate.stdout}${validate.stderr}`);
  if (validate.code !== 0) {
    await fs.unlink(staged).catch(() => {});
    return {
      ok: false,
      output: truncate(log.join('\n')),
      error: 'BIRD rejected the generated config, so nothing was applied.',
      previousConfig,
    };
  }

  if (previousConfig) {
    await fs.writeFile(`${configPath}.bak`, previousConfig, 'utf-8').catch(() => {});
  }
  await fs.rename(staged, configPath);

  const r = reloadArgv(rs);
  const reload = await execFileAsync(r.file, r.args);
  log.push(`$ ${r.file} ${r.args.join(' ')}\n${reload.stdout}${reload.stderr}`);

  if (reload.code !== 0) {
    // Put the old config back so the next reload can't pick up something broken.
    if (previousConfig) await fs.writeFile(configPath, previousConfig, 'utf-8').catch(() => {});
    return {
      ok: false,
      output: truncate(log.join('\n')),
      error: 'Reload failed; the previous config was restored on disk.',
      previousConfig,
    };
  }

  return { ok: true, output: truncate(log.join('\n')), previousConfig };
};

/** Copy over SSH, validate remotely, then reload remotely. */
const deploySsh = async (rs: IRouteServer, config: string): Promise<DeployTransportResult> => {
  const configPath = assertSafe(rs.configPath || '', SAFE_PATH, 'Config path');
  const host = assertSafe(rs.sshHost || '', SAFE_HOST, 'SSH host');
  const log: string[] = [];

  // Read the current remote config so a rollback has something to restore.
  const catRemote = sshArgv(rs, { file: 'cat', args: [configPath] });
  const existing = await execFileAsync(catRemote.file, catRemote.args);
  const previousConfig = existing.code === 0 ? existing.stdout : '';

  const staged = `${configPath}.mxix-new`;
  const tmp = path.join(os.tmpdir(), `mxix-bird-${crypto.randomBytes(8).toString('hex')}.conf`);
  await fs.writeFile(tmp, config, { encoding: 'utf-8', mode: 0o600 });

  try {
    const port = Number(rs.sshPort || 22);
    const user = rs.sshUser ? assertSafe(rs.sshUser, SAFE_USER, 'SSH user') : '';
    const scpArgs = [
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      '-o', 'ConnectTimeout=10',
      '-P', String(port),
    ];
    if (rs.sshKeyPath) scpArgs.push('-i', assertSafe(rs.sshKeyPath, SAFE_PATH, 'SSH key path'));
    scpArgs.push(tmp, `${user ? `${user}@` : ''}${host}:${staged}`);

    const copy = await execFileAsync('scp', scpArgs, { timeout: 60000 });
    log.push(`$ scp → ${host}:${staged}\n${copy.stdout}${copy.stderr}`);
    if (copy.code !== 0) {
      return { ok: false, output: truncate(log.join('\n')), error: `Could not copy the config to ${host}.`, previousConfig };
    }

    const v = sshArgv(rs, validateArgv(rs, staged));
    const validate = await execFileAsync(v.file, v.args);
    log.push(`$ ssh ${host} birdc configure check\n${validate.stdout}${validate.stderr}`);
    if (validate.code !== 0) {
      const cleanup = sshArgv(rs, { file: 'rm', args: ['-f', staged] });
      await execFileAsync(cleanup.file, cleanup.args);
      return {
        ok: false,
        output: truncate(log.join('\n')),
        error: 'BIRD rejected the generated config, so nothing was applied.',
        previousConfig,
      };
    }

    // Back up and move into place in one remote step.
    const install = sshArgv(rs, {
      file: 'sh',
      args: ['-c', `cp -f ${configPath} ${configPath}.bak 2>/dev/null; mv -f ${staged} ${configPath}`],
    });
    const installed = await execFileAsync(install.file, install.args);
    log.push(`$ ssh ${host} install config\n${installed.stdout}${installed.stderr}`);
    if (installed.code !== 0) {
      return { ok: false, output: truncate(log.join('\n')), error: 'Could not move the config into place.', previousConfig };
    }

    const r = sshArgv(rs, reloadArgv(rs));
    const reload = await execFileAsync(r.file, r.args);
    log.push(`$ ssh ${host} reload\n${reload.stdout}${reload.stderr}`);
    if (reload.code !== 0) {
      const restore = sshArgv(rs, {
        file: 'sh',
        args: ['-c', `test -f ${configPath}.bak && mv -f ${configPath}.bak ${configPath}`],
      });
      await execFileAsync(restore.file, restore.args);
      return {
        ok: false,
        output: truncate(log.join('\n')),
        error: 'Reload failed; the previous config was restored on the route server.',
        previousConfig,
      };
    }

    return { ok: true, output: truncate(log.join('\n')), previousConfig };
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
};

/**
 * Hand the config to an agent running on the BIRD host.
 *
 * The agent owns validation and reload, which is what makes this the right
 * transport for a bespoke reload procedure — the script stays on the route
 * server instead of being editable through this API.
 */
const deployAgent = async (rs: IRouteServer, config: string): Promise<DeployTransportResult> => {
  const url = String(rs.agentUrl || '').trim();
  if (!url) return { ok: false, output: '', error: 'No agent URL is configured.' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, output: '', error: 'The agent URL is not a valid URL.' };
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    return {
      ok: false,
      output: '',
      error: 'The agent URL must use HTTPS (the config carries BGP session passwords).',
    };
  }

  // The token is select:false on the model, so re-read it explicitly.
  const withToken = await RouteServer.findById(rs._id).select('+agentToken').lean();
  const token = (withToken as any)?.agentToken || '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ config, configPath: rs.configPath || '', validate: true, reload: true }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await r.text();
    let payload: any;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { output: text };
    }

    if (!r.ok) {
      return {
        ok: false,
        output: truncate(String(payload?.output || text || '')),
        error: `The agent returned ${r.status}${payload?.error ? ` — ${payload.error}` : ''}`,
        previousConfig: payload?.previousConfig || '',
      };
    }
    return {
      ok: payload?.ok !== false,
      output: truncate(String(payload?.output || '')),
      error: payload?.ok === false ? payload?.error || 'The agent reported a failure.' : undefined,
      previousConfig: payload?.previousConfig || '',
    };
  } catch (err: any) {
    return {
      ok: false,
      output: '',
      error: err?.name === 'AbortError' ? 'The agent request timed out.' : `Could not reach the agent: ${err?.message}`,
    };
  }
};

// ── Public API ──

export interface DeployResult {
  routeServer: string;
  name: string;
  applied: boolean;
  skipped?: boolean;
  reason?: string;
  configHash: string;
  peerCount: number;
  output?: string;
  error?: string;
  warnings: string[];
  deploymentId?: string;
  durationMs: number;
}

export interface DeployOptions {
  actor?: string;
  /** Deploy even when the generated config is identical to the last one. */
  force?: boolean;
  /** Build and record, but do not touch the route server. */
  dryRun?: boolean;
}

/**
 * Generate and push the config for one route server.
 *
 * Records every attempt in BirdDeployment (with the previous config, so a
 * rollback is possible) and writes an audit entry. A build that produces zero
 * peers is refused unless forced — an empty route server is almost always a
 * data problem, and pushing it would drop every session at once.
 */
export const deployRouteServer = async (
  routeServerId: string | Types.ObjectId,
  opts: DeployOptions = {}
): Promise<DeployResult> => {
  const startedAt = Date.now();
  const rs = await RouteServer.findById(routeServerId);
  if (!rs) throw new Error('Route server not found');

  // Secrets must be real in a deployed config, so the redaction used for
  // previews is switched off here.
  const build = await buildConfig(rs._id as Types.ObjectId, { redactSecrets: false });

  const base = {
    routeServer: String(rs._id),
    name: rs.name,
    configHash: build.configHash,
    peerCount: build.stats.totalPeers,
    warnings: build.warnings,
  };

  if (build.stats.totalPeers === 0 && !opts.force) {
    return {
      ...base,
      applied: false,
      skipped: true,
      reason:
        'The generated config has no peers. That would tear down every session, so it was not applied. Use force if this is intentional.',
      durationMs: Date.now() - startedAt,
    };
  }

  if (opts.dryRun) {
    return { ...base, applied: false, skipped: true, reason: 'Dry run — nothing was sent.', durationMs: Date.now() - startedAt };
  }

  if (rs.deployMethod === 'manual') {
    return {
      ...base,
      applied: false,
      skipped: true,
      reason: 'This route server is set to manual deployment. Copy the generated config to the host yourself.',
      durationMs: Date.now() - startedAt,
    };
  }

  if (!opts.force && rs.lastDeployHash && rs.lastDeployHash === build.configHash) {
    return {
      ...base,
      applied: false,
      skipped: true,
      reason: 'The generated config is identical to what is already deployed.',
      durationMs: Date.now() - startedAt,
    };
  }

  let result: DeployTransportResult;
  try {
    if (rs.deployMethod === 'local') result = await deployLocal(rs, build.config);
    else if (rs.deployMethod === 'ssh') result = await deploySsh(rs, build.config);
    else result = await deployAgent(rs, build.config);
  } catch (err: any) {
    result = { ok: false, output: '', error: err?.message || 'Deployment failed.' };
  }

  const durationMs = Date.now() - startedAt;

  const deployment = await BirdDeployment.create({
    routeServer: rs._id,
    configHash: build.configHash,
    config: build.config,
    previousConfig: result.previousConfig || '',
    result: result.ok ? 'success' : 'failed',
    method: rs.deployMethod,
    peerCount: build.stats.totalPeers,
    output: result.output || '',
    error: result.error || '',
    actor: opts.actor || 'system',
    durationMs,
  });

  if (result.ok) {
    rs.lastDeployedAt = new Date();
    rs.lastDeployHash = build.configHash;
    await rs.save();
  }

  await logAudit({
    actor: opts.actor,
    action: result.ok ? 'bird.deploy' : 'bird.deploy_failed',
    resource: 'RouteServer',
    resourceId: String(rs._id),
    after: {
      name: rs.name,
      method: rs.deployMethod,
      peers: build.stats.totalPeers,
      configHash: build.configHash,
      error: result.error,
    },
  });

  return {
    ...base,
    applied: result.ok,
    output: result.output,
    error: result.error,
    deploymentId: String(deployment._id),
    durationMs,
  };
};

/**
 * Deploy every enabled route server on an infrastructure.
 *
 * Runs sequentially and on purpose: pushing to rs1 and rs2 at the same moment
 * removes the safety net of having one known-good route server if the new config
 * turns out to be bad.
 */
export const deployInfrastructure = async (
  infrastructureId: string | Types.ObjectId,
  opts: DeployOptions = {}
): Promise<DeployResult[]> => {
  const servers = await RouteServer.find({ infrastructure: infrastructureId, enabled: true })
    .sort({ order: 1, name: 1 })
    .select('_id');

  const results: DeployResult[] = [];
  for (const s of servers) {
    try {
      results.push(await deployRouteServer(s._id as Types.ObjectId, opts));
    } catch (err: any) {
      results.push({
        routeServer: String(s._id),
        name: '',
        applied: false,
        configHash: '',
        peerCount: 0,
        warnings: [],
        error: err?.message || 'Deployment failed.',
        durationMs: 0,
      });
    }
  }
  return results;
};

/** Push to every enabled route server across every infrastructure. */
export const deployAll = async (opts: DeployOptions = {}): Promise<DeployResult[]> => {
  const servers = await RouteServer.find({ enabled: true, infrastructure: { $ne: null } })
    .sort({ order: 1, name: 1 })
    .select('_id');

  const results: DeployResult[] = [];
  for (const s of servers) {
    try {
      results.push(await deployRouteServer(s._id as Types.ObjectId, opts));
    } catch (err: any) {
      results.push({
        routeServer: String(s._id),
        name: '',
        applied: false,
        configHash: '',
        peerCount: 0,
        warnings: [],
        error: err?.message || 'Deployment failed.',
        durationMs: 0,
      });
    }
  }
  return results;
};

/**
 * Restore the config captured by an earlier deployment.
 *
 * Uses the stored text verbatim rather than regenerating, because the point of a
 * rollback is to get back to the exact bytes that were known to work.
 */
export const rollbackDeployment = async (
  deploymentId: string | Types.ObjectId,
  opts: { actor?: string } = {}
): Promise<DeployResult> => {
  const startedAt = Date.now();
  const deployment = await BirdDeployment.findById(deploymentId);
  if (!deployment) throw new Error('Deployment not found');

  const target = deployment.previousConfig;
  if (!target) {
    throw new Error('This deployment did not capture a previous config, so there is nothing to roll back to.');
  }

  const rs = await RouteServer.findById(deployment.routeServer);
  if (!rs) throw new Error('Route server not found');
  if (rs.deployMethod === 'manual') {
    throw new Error('This route server is set to manual deployment.');
  }

  let result: DeployTransportResult;
  try {
    if (rs.deployMethod === 'local') result = await deployLocal(rs, target);
    else if (rs.deployMethod === 'ssh') result = await deploySsh(rs, target);
    else result = await deployAgent(rs, target);
  } catch (err: any) {
    result = { ok: false, output: '', error: err?.message || 'Rollback failed.' };
  }

  const durationMs = Date.now() - startedAt;
  const hash = crypto.createHash('sha256').update(target).digest('hex');

  const record = await BirdDeployment.create({
    routeServer: rs._id,
    configHash: hash,
    config: target,
    previousConfig: result.previousConfig || deployment.config,
    result: result.ok ? 'rolled-back' : 'failed',
    method: rs.deployMethod,
    peerCount: 0,
    output: result.output || '',
    error: result.error || '',
    actor: opts.actor || 'system',
    durationMs,
  });

  if (result.ok) {
    rs.lastDeployedAt = new Date();
    rs.lastDeployHash = hash;
    await rs.save();
  }

  await logAudit({
    actor: opts.actor,
    action: result.ok ? 'bird.rollback' : 'bird.rollback_failed',
    resource: 'RouteServer',
    resourceId: String(rs._id),
    before: { configHash: deployment.configHash },
    after: { configHash: hash, error: result.error },
  });

  return {
    routeServer: String(rs._id),
    name: rs.name,
    applied: result.ok,
    configHash: hash,
    peerCount: 0,
    output: result.output,
    error: result.error,
    warnings: [],
    deploymentId: String(record._id),
    durationMs,
  };
};

/** Recent deployment history for one route server (config text excluded). */
export const getDeploymentHistory = async (
  routeServerId: string | Types.ObjectId,
  limit = 25
): Promise<any[]> =>
  BirdDeployment.find({ routeServer: routeServerId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(1, limit), 200))
    .select('-config -previousConfig')
    .lean();

/**
 * Reachability check for a route server host, so an operator can confirm the
 * transport works before trusting it with a real deploy.
 */
export const testConnection = async (
  routeServerId: string | Types.ObjectId
): Promise<{ ok: boolean; output: string; error?: string }> => {
  const rs = await RouteServer.findById(routeServerId);
  if (!rs) throw new Error('Route server not found');

  try {
    if (rs.deployMethod === 'manual') {
      return { ok: false, output: '', error: 'This route server is set to manual deployment; there is nothing to test.' };
    }

    if (rs.deployMethod === 'agent') {
      const probe = await deployAgent({ ...(rs.toObject() as any), configPath: rs.configPath } as IRouteServer, '');
      return { ok: probe.ok, output: probe.output, error: probe.error };
    }

    const argv = rs.deployMethod === 'local'
      ? withSudo(rs, 'birdc', ['-s', assertSafe(rs.birdSocket || '', SAFE_PATH, 'BIRD control socket'), 'show', 'status'])
      : sshArgv(rs, withSudo(rs, 'birdc', ['-s', assertSafe(rs.birdSocket || '', SAFE_PATH, 'BIRD control socket'), 'show', 'status']));

    const res = await execFileAsync(argv.file, argv.args, { timeout: 20000 });
    return {
      ok: res.code === 0,
      output: truncate(`${res.stdout}${res.stderr}`, 2000),
      error: res.code === 0 ? undefined : 'Could not query BIRD on the route server.',
    };
  } catch (err: any) {
    return { ok: false, output: '', error: err?.message || 'Connection test failed.' };
  }
};

export default {
  deployRouteServer,
  deployInfrastructure,
  deployAll,
  rollbackDeployment,
  getDeploymentHistory,
  testConnection,
};
