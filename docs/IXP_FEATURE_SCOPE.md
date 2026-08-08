# MX-IX Admin — IXP Manager Feature Parity Scope

Goal: run the **entire** IX from the MX-IX admin panel and retire IXP Manager.

Feature list derived from the official IXP Manager documentation index
([docs.ixpmanager.org](https://docs.ixpmanager.org/latest/) — `features/` and `usage/`
sections). Content summarised; see the upstream docs for detail.

## Target architecture

```
Organization (member)
  └── VirtualInterface        (their connection to one Infrastructure = LAG container)
        ├── PhysicalInterface  ──> SwitchPort ──> Switch/Device
        │                                          └── Cabinet ──> Facility (data centre)
        └── VlanInterface      ──> Vlan + IpAddress(v4/v6)     [THE PEER RECORD]
                                     │
                                     └──> BIRD config on each route server
```

- Each **BIRD runs on its own server**: 1 BIRD daemon per host, **2 hosts per location**
  (rs1, rs2) for redundancy. Config is pushed per-host over SSH or an HTTP agent.
- **One centralised Alice-LG** aggregates every route server as a `[[sources]]` entry.
- Physical flow the admin must walk: **Org → Data Centre → Rack → Rack Unit → Device → Port**.

## Status legend

| Mark | Meaning |
|---|---|
| **Have** | Already working in MX-IX before this project |
| **Built** | Delivered in this project |
| **Todo** | Not started |

---

## 1. Physical infrastructure

| # | Feature | IXP Manager ref | Status | Notes |
|---|---|---|---|---|
| 1.1 | Infrastructures (an IXP = a peering LAN of switches) | `install/next-steps` | **Built** | `infrastructure.model.ts` — own ASN, shortname, MTU, PeeringDB ix/ixlan ids |
| 1.2 | Facilities / data centres | `usage/switches` | **Built** | `facility.model.ts` — address, geo, PeeringDB `fac` id, CLLI, remote-hands contacts |
| 1.3 | Cabinets / racks | `usage/switches` | **Built** | `cabinet.model.ts` — uHeight, numbering direction, cage/row refs, power feeds |
| 1.4 | Rack units + device elevation | `usage/switches` | **Built** | `rack.service.ts` — `getRackElevation` (per-face grid, free runs), `checkPlacement` (overlap + height validation) |
| 1.5 | Switches / devices | `usage/switches` | **Built** | `switch.model.ts` — cabinet + facility refs, `rackPosition`/`rackUnits`/`rackFace`, `deviceType` |
| 1.6 | Switch ports | `usage/switches` | **Built** | `switchPort.model.ts` — type, ifIndex, speed, status, unique per switch |
| 1.7 | Patch panels + ports | `features/patch-panels` | **Built** | `patchPanel.model.ts` + `patchPanelPort.model.ts` — duplex pairing via `duplexPartner` |
| 1.8 | Cross-connects + LOAs | `features/patch-panels` | **Built** (model) | LOA code (unique), xconnect ref, 9-state lifecycle, key dates. LOA *document* generation still Todo |
| 1.9 | Core bundles (inter-switch links / trunks) | `features/core-bundles` | **Built** | `coreBundle.model.ts` + `coreLink.model.ts` — per-strand links so a partial bundle failure is visible |
| 1.10 | Console servers (OOB access) | `features/console-servers` | **Built** (model) | Folded into `switch.model.ts` as `deviceType: 'console-server'`, with `consoleServer` + `consolePort` on each device |

## 2. Members, connections, addressing

| # | Feature | IXP Manager ref | Status | Notes |
|---|---|---|---|---|
| 2.1 | Customers / members | `usage/customers` | **Have** | `Organization` + `CustomersAdminPanel` |
| 2.2 | Customer contacts + contact groups | `usage/contacts` | **Todo** | Roles (NOC/peering/billing/admin), group-based mailing |
| 2.3 | Customer notes | `usage/customer-notes` | **Todo** | Per-customer timestamped notes, staff-only vs shared |
| 2.4 | Customer tags | `usage/customer-tags` | **Todo** | Arbitrary tagging + filtering |
| 2.5 | Virtual interfaces (LAG container) | `usage/interfaces` | **Built** | `virtualInterface.model.ts` |
| 2.6 | Physical interfaces | `usage/interfaces` | **Built** | `physicalInterface.model.ts` — unique per switch port |
| 2.7 | VLAN interfaces (**the peer record**) | `usage/interfaces` | **Built** | `vlanInterface.model.ts` — rsClient, rsMode, filters, max-prefix, MD5 |
| 2.8 | VLANs (peering / quarantine / private) | `usage/interfaces` | **Built** | `vlan.model.ts` |
| 2.9 | IPv4 / IPv6 address management | `usage/interfaces` | **Built** | `ipAddress.model.ts` + `ipam.service.ts` — atomic next-free allocation |
| 2.10 | Layer 2 / MAC addresses | `features/layer2-addresses` | **Built** | `macAddress.model.ts` + `mac.util.ts` — normalised storage, declared vs learned, OUI helpers |
| 2.11 | Reseller support | `features/reseller` | **Todo** | Field exists on `virtualInterface`; workflow + billing split missing |
| 2.12 | Quarantine → live provisioning flow | `usage/interfaces` | **Todo** | Move member between quarantine and peering VLAN |

## 3. Route servers & routing security

| # | Feature | IXP Manager ref | Status | Notes |
|---|---|---|---|---|
| 3.1 | Route server BIRD config generation | `features/route-servers` | **Built** | `birdConfig.service.ts` — full `bird.conf`, per-peer import/export filters |
| 3.2 | Config deploy + reload + rollback | `features/route-servers` | **Built** | `birdDeploy.service.ts` — local/SSH/agent, validate-before-apply, auto-restore on failure, `birdDeployment` history + rollback |
| 3.3 | Route server model | `features/routers` | **Built** | `routeServer.model.ts` — BIRD target + Alice-LG source in one record |
| 3.4 | IRRDB prefix + origin ASN filtering | `features/irrdb` | **Todo** | as-set expansion via bgpq4 into `irrdbPrefix` cache; per-member opt-out |
| 3.5 | RPKI / RTR validation | `features/rpki` | **Todo** | `protocol rpki` + RTR session; reject invalids |
| 3.6 | Max-prefix limits | `features/route-servers` | **Built** | Per-peer override → PeeringDB `info_prefixes4/6` → RS default; `import limit … action restart` |
| 3.7 | Bogon prefix + bogon ASN filters | `features/route-servers` | **Built** | RFC 6890 v4/v6 lists + reserved/private ASN ranges + peering-LAN rejection |
| 3.8 | BGP control communities | `features/route-servers` | **Built** | `announce_to()` — standard + large communities, allow-list semantics, RFC 8326 graceful shutdown |
| 3.9 | Blackholing (RTBH) | — | **Have** (partial) | `Blackhole` model + portal UI exist; **no** announcement into BIRD yet |
| 3.10 | Route collectors | `features/route-collectors` | **Todo** | Collector config generation |
| 3.11 | AS112 node | `features/as112` | **Todo** | AS112 client flag exists on `vlanInterface`; config generation missing |
| 3.12 | MANRS compliance reporting | `features/manrs` | **Todo** | Report per-member filtering/anti-spoofing posture |
| 3.13 | RIR object generation (as-set / route) | `features/rir-objects` | **Todo** | Generate RIR-submittable objects for our own ASN |
| 3.14 | Looking glass | `features/looking-glass` | **Have** | Alice-LG proxy (`lg.controller.ts`) + centralised `alice.conf` generation |

## 4. Integrations & data exchange

| # | Feature | IXP Manager ref | Status | Notes |
|---|---|---|---|---|
| 4.1 | PeeringDB sync (member auto-fill) | `features/peeringdb` | **Built** | `peeringdb.service.ts` — net/ix/fac/netixlan/poc + Organization mapping |
| 4.2 | PeeringDB OAuth login | `features/peeringdb-oauth` | **Todo** | "Sign in with PeeringDB" for the member portal |
| 4.3 | IX-F member export | `features/ixf-export` | **Todo** | Publish our own IX-F JSON (we become the source of truth) |
| 4.4 | Member list export | `features/member-export` | **Todo** | Public/most-formats member list |
| 4.5 | Peering matrix | `features/peering-matrix` | **Todo** | Who-peers-with-whom grid |
| 4.6 | Peering manager (bilateral requests) | `features/peering-manager` | **Have** (partial) | `PeeringRequest` + portal UI; needs session state tracking |
| 4.7 | Reverse DNS / ARPA zone generation | `features/dns-arpa` | **Todo** | PTR zones for peering LAN addresses |
| 4.8 | Nagios / monitoring config export | `features/nagios` | **Todo** | Per-VLAN, per-protocol monitoring targets |
| 4.9 | TACACS user list export | `features/tacacs` | **Todo** | Formatted device auth lists |
| 4.10 | Mailing lists (Mailman) | `features/mailing-lists` | **Todo** | Member subscribe/unsubscribe |
| 4.11 | Helpdesk integration | `features/helpdesk` | **Have** | Own ticket system (`Ticket` + support desk panel) |
| 4.12 | Switch/router provisioning templates | `features/provisioning` | **Todo** | Generate member port config for the switch itself |
| 4.13 | IXP Manager one-time import | — | **Todo** | Read existing IX-F export into native models, then retire the integration |

## 5. Statistics & graphing

| # | Feature | IXP Manager ref | Status | Notes |
|---|---|---|---|---|
| 5.1 | Graphing abstraction | `grapher/introduction` | **Have** | Grafana + Zabbix datasource (`grafana.controller.ts`, `portalTraffic.controller.ts`) |
| 5.2 | Per-port / per-member traffic graphs | `grapher/mrtg` | **Have** | Zabbix host+interface per port, avg/peak/p95 |
| 5.3 | Aggregate fabric stats | `grapher/mrtg` | **Have** | `globalFabricStats`, `networkStats` |
| 5.4 | sFlow collection | `features/sflow` | **Have** (partial) | Embed via `flowGraph.urlTemplate` |
| 5.5 | sFlow peer-to-peer graphs | `features/sflow-p2p` | **Todo** | Per-peer-pair traffic breakdown |
| 5.6 | Latency / smokeping | `grapher/smokeping` | **Todo** | Per-member latency graphs |

## 6. Platform, users & content

| # | Feature | IXP Manager ref | Status | Notes |
|---|---|---|---|---|
| 6.1 | Admin users + roles | `usage/users` | **Have** | `User` + `adminRoleMiddleware` + `ROLE_ACCESS` |
| 6.2 | Customer portal users + roles | `usage/users` | **Have** | `PortalUser` (admin/billing/viewer) |
| 6.3 | Authentication + 2FA | `usage/authentication` | **Have** | JWT, dual admin/portal realms, TOTP 2FA |
| 6.4 | App passwords / API tokens | `features/app-passwords` | **Todo** | Per-integration credentials |
| 6.5 | REST API | `features/api` | **Have** | Own API under `/api` |
| 6.6 | DB change logs / audit | `usage/dblogs` | **Have** | `AuditLog` + `AuditLogPanel` with before/after diff |
| 6.7 | Settings | `features/settings` | **Have** | `Settings` singleton + integrations panel |
| 6.8 | Email to members / templates | `usage/email` | **Have** | `EmailTemplate` + mailer + announcements |
| 6.9 | Document store | `features/docstore` | **Todo** | Per-customer + public documents (LOAs, invoices, policies) |
| 6.10 | Operational notes | `usage/operational-notes` | **Todo** | Internal ops notes |
| 6.11 | Static content / CMS | `features/static-content` | **Have** | Services, locations, homepage, stats, contacts, members panels |
| 6.12 | Skinning / theming | `features/skinning` | **Have** | Tailwind + `admin-light` theme layer |
| 6.13 | Cookie consent | `usage/cookies` | **Todo** | — |
| 6.14 | Scheduled jobs | `features/cronjobs` | **Have** (partial) | `setInterval` for alerts + digests; needs IRRDB/PeeringDB refresh jobs |

---

## Build order

Numbers refer to the table rows above.

1. **Physical hierarchy** — 1.4, 1.5, 1.7, 1.8, 2.10 (device/rack/patch-panel/MAC models)
2. **BIRD generator** — 3.1, 3.6, 3.7, 3.8 (the core deliverable)
3. **Filtering** — 3.4, 3.5 (IRRDB + RPKI)
4. **Deploy** — 3.2 (per-host SSH/agent push, validate, rollback)
5. **Auto-provision** — 2.12 + orchestration: create member → allocate IP → build peer → push to both route servers
6. **Admin API + UI** — controllers, routes, panels for everything above
7. **Exports** — 4.3, 4.4, 4.5, 4.7
8. **Remaining ops features** — 1.9, 1.10, 3.9–3.13, 4.x, 5.5, 6.x
9. **Migration** — 4.13, then disable the IXP Manager integration

## Deliberate design decisions

- **Rack units are derived, not stored.** A device records the lowest unit it occupies
  plus its height; the elevation view is computed. Storing 42 rows per rack would only
  create a second place for the truth to drift.
- **IPs are never hand-typed.** Allocation is a single atomic document update on
  `IpAddress.assignedTo`, so two concurrent provisioning runs cannot collide.
- **IRRDB filtering fails closed by default.** If a peer has filtering enabled but no
  cached prefixes, the generated filter rejects everything. `RouteServer.irrdbFailOpen`
  lets an operator opt into the riskier behaviour knowingly.
- **Shell commands used for deploy are operator-configured only**, never built from
  request data.
- **`RouteServer` is both** a BIRD deploy target and an Alice-LG source, so one record
  describes a route server completely.
