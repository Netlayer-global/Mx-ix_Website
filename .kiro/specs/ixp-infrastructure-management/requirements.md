# Requirements Document

## Introduction

MX-IX currently relies on an external IXP Manager instance as the operational
source of truth for members, ports and physical provisioning. This feature
replaces that dependency with a **fully in-house IXP + Data Center Infrastructure
Management (DCIM)** system built directly into the MX-IX platform.

The goal is to model and manage the complete physical and logical hierarchy an
Internet Exchange needs — from the building down to a single fibre — and tie it
to the existing member/order workflow, so MX-IX becomes self-sufficient:

```
Data Center (facility)
  └─ Room / Suite
       └─ Rack (cabinet)
            └─ Rack Unit (U position)
                 └─ Device (switch / patch panel / router)
                      └─ Physical Port (interface)
                           └─ Cross-connect / Cable
                                └─ Member Connection (virtual interface)
                                     └─ VLAN + IP (peering LAN)
                                          └─ BGP session (route server)
```

This system must coexist with the existing models (`Organization`, `Location`,
`Port`, `Order`, `Member`) and reuse them where possible rather than duplicating.

### Goals
- Manage the full DCIM hierarchy: data centers, rooms, racks, rack units, patch panels, devices, physical ports, and cabling/cross-connects.
- Manage the IXP logical layer: switches, member connections (virtual interfaces), VLANs, IP allocations (IPAM), and route-server BGP sessions.
- Track capacity and utilization at every level (rack power/space, switch ports, peering-LAN IP usage).
- Tie infrastructure to members and orders so provisioning is end-to-end inside MX-IX.
- Remove the runtime dependency on IXP Manager (keep a one-time import path for migration).

### In Scope (revised)
- Full DCIM hierarchy and IXP logical layer (as above).
- **BIRD route-server configuration generation, validation, approved deployment and rollback** — a member's BGP session is created end to end from MX-IX without touching another system.
- **PeeringDB integration** — inbound enrichment (prefix limits, AS-SET, contacts, presence) and outbound publication.
- **IRRDB prefix-list generation and RPKI route origin validation** feeding the generated filters.
- **Monitoring auto-provisioning** into the existing Zabbix / Grafana / Alice-LG stack.
- **95th-percentile billing export** into the existing Zoho Books flow.

### Non-Goals (this phase)
- Auto-pushing live configuration to member-facing **switches**. Switch configuration is *generated* for an engineer to apply; automated switch push is a later phase.
- Replacing the accounting system. Invoices remain in Zoho Books; MX-IX supplies the usage figures.
- Replacing Grafana/Zabbix as the metrics store. MX-IX provisions and reads them, it does not store time-series itself.

## Operational Flow

This feature must support three distinct flows. Requirements later in this
document are grouped to serve them, and no step below may require leaving the
MX-IX platform.

### Flow A — One-time platform setup (before the first member)

Executed once per exchange, in this order, because each step depends on the one
above it.

| # | Step | Produces |
|---|---|---|
| A1 | Admin users, roles, 2FA | Who may operate the platform |
| A2 | Integration credentials (PeeringDB, Zabbix, Grafana, Zoho, SMTP, RPKI validator, IRR source) | External systems reachable |
| A3 | Operator's own organisation and ASNs | The exchange's own identity |
| A4 | Data centres, rooms/suites | Where equipment lives |
| A5 | Racks with U height, power and weight capacity | Mountable space |
| A6 | Devices mounted at U positions (switches, routers, patch panels, console servers) | Physical inventory |
| A7 | Device physical ports (manual or discovered) | Connectable endpoints |
| A8 | Cross-connects between ports (switch ↔ patch panel ↔ meet-me room) | Traceable cabling |
| A9 | Core bundles / inter-switch links | The fabric itself |
| A10 | Infrastructure grouping (which switches form one exchange fabric) | Logical exchange |
| A11 | VLANs with IPv4 and IPv6 peering-LAN subnets | Addressable segments |
| A12 | IPAM pools derived from those subnets, with reservations | Assignable addresses |
| A13 | Route servers, route collector, AS112 as instances with ASN and peering-LAN IPs | Peering control plane |
| A14 | Deployment agent installed on each route-server host, token registered | Safe config delivery |
| A15 | Filter policy defaults: max-prefix policy, RPKI mode, IRR source, BGP community scheme | Consistent routing policy |
| A16 | Configuration templates rendered, validated and baselined | Known-good starting config |
| A17 | Monitoring templates, Grafana dashboards, Alice-LG sources | Observability |
| A18 | Status-page components, email templates | Member communication |

### Flow B — Member onboarding (repeated per member)

| # | Step | Notes |
|---|---|---|
| B1 | Enquiry or self-service signup arrives | Existing contact/onboarding flow |
| B2 | Create or approve the member organisation | PeeringDB lookup by ASN auto-fills name, prefix counts, AS-SET, policy and contacts |
| B3 | Record contacts and contact groups | NOC, technical, billing, peering |
| B4 | Upload agreement, LOA and KYC documents | Document store |
| B5 | Link billing profile | Zoho contact, currency, billing frequency |
| B6 | Create portal users, send welcome email | Member gains portal access |
| B7 | Member or admin raises a port order | Location, speed, add-ons |
| B8 | Approve the order | Starts provisioning |
| B9 | Reserve a switch port matching location and speed | Capacity checked |
| B10 | Create the member connection, LAG when multiple ports | Virtual interface |
| B11 | Assign the VLAN | Peering LAN chosen |
| B12 | Allocate IPv4 and IPv6 from the pool | Atomic, no double assignment |
| B13 | Record MAC addresses | For port security and L2 filtering |
| B14 | Set routing policy: max-prefix, AS-SET, optional MD5, route-server client flag | Defaults sourced from PeeringDB |
| B15 | Raise the cross-connect request and record A/Z ends when patched | Physical path complete |
| B16 | Optionally place the connection in the quarantine VLAN for testing | Protects production peers |
| B17 | Generate switch port configuration for an engineer to apply | Vendor template |
| B18 | Generate the route-server peer configuration | Per-member include file |
| B19 | Validate and review the configuration diff | Removals flagged explicitly |
| B20 | Approve and deploy, then soft-reload the route servers | Approval gate enforced |
| B21 | Verify the session establishes and prefixes are received | Automated post-check |
| B22 | Provision monitoring: Zabbix host and interface, Grafana, Alice-LG | Graphs start populating |
| B23 | Move out of quarantine into the production VLAN | If quarantine was used |
| B24 | Activate the connection and notify the member | Billing may begin |
| B25 | Publish: public member list, IX-F export, PeeringDB presence | Ecosystem visibility |

### Flow C — Daily and recurring operations (after members are live)

**Continuous and automated**
- Traffic polling and 95th-percentile accumulation.
- BGP session state monitoring and flap detection.
- Nightly IRR prefix-set refresh and RPKI validator synchronisation.
- Nightly PeeringDB synchronisation with drift alerts when a member's declared prefix limits change.
- Threshold alerting on utilisation, packet loss and availability.
- Configuration drift detection between generated and running configuration.
- Database backups.

**Daily**
- NOC review: sessions down, errored ports, capacity at risk.
- Support ticket triage against SLA.
- Order queue and approvals.
- Bilateral peering request queue.
- Blackhole (RTBH) request review.

**Weekly**
- Capacity review: switch ports by speed and location, rack U, power, IP pool utilisation.
- Cross-connect reconciliation of planned versus active.
- Reports on RPKI-invalid prefixes and members near their max-prefix limit.
- Free-port report for sales.

**Monthly**
- 95th-percentile billing run feeding invoices.
- Per-member availability and SLA reporting.
- Traffic reports and the member-to-member peering matrix.
- Member directory and IX-F export verification.
- Audit-log review.

**Event-driven**
- Port upgrade: order, allocate new port, migrate the connection, decommission the old port.
- Additional connection or LAG member added.
- Member expands to a new location.
- MAC change, IP change or equipment swap.
- Planned maintenance: notify, execute, verify, close.
- Incident: status page, member notification, resolution and review.
- Suspension for non-payment and later restoration.
- Offboarding: withdraw sessions, release IPs, remove cross-connects, free ports, archive documents, final invoice.
- Route-server maintenance with graceful drain and restore.
- Security response: blackhole activation, prefix-hijack handling.

## Glossary
- **Data Center (DC):** A physical facility/building that houses IXP equipment.
- **Rack:** A cabinet within a DC room, measured in rack units (U).
- **Rack Unit (U):** A single 44.45 mm mounting position in a rack.
- **Patch Panel:** A passive device with ports used to organize/terminate cabling.
- **Device:** Any rack-mounted equipment (switch, router, patch panel, server).
- **Physical Port:** A physical interface on a device (e.g. a switch SFP+ cage).
- **Cross-connect:** A physical cable linking two ports (often member ↔ switch).
- **Member Connection (Virtual Interface):** A member's logical connection on the fabric, bound to one or more physical ports.
- **VLAN:** A peering LAN segment.
- **IPAM:** IP Address Management — allocation of IPv4/IPv6 from peering-LAN ranges.
- **Route Server:** A BGP daemon that simplifies multilateral peering.

## Requirements

### Requirement 1: Data Center & Facility Management
**User Story:** As an IXP operator, I want to manage data center facilities, so that all physical infrastructure has a known location.

#### Acceptance Criteria
1. WHEN an admin creates a data center THEN the system SHALL store its name, code, address, city, country, and an optional link to an existing `Location`.
2. THE system SHALL allow a data center to contain one or more rooms/suites.
3. WHEN an admin views a data center THEN the system SHALL display total racks, total/used rack units, and total power capacity vs used.
4. IF a data center has dependent racks THEN the system SHALL prevent deletion until those racks are removed or reassigned.
5. THE system SHALL allow marking a data center as `active`, `planned`, or `decommissioned`.

### Requirement 2: Rack Management
**User Story:** As an IXP operator, I want to manage racks inside a data center, so that I can place equipment precisely.

#### Acceptance Criteria
1. WHEN an admin creates a rack THEN the system SHALL store its name/label, data center, room, height in U (default 42U), and optional power capacity (kW) and max weight.
2. THE system SHALL provide a visual rack elevation showing each U position as occupied or free.
3. WHEN a device is mounted THEN the system SHALL mark the spanned U positions as occupied and SHALL prevent overlapping placements.
4. IF an admin attempts to mount a device into already-occupied U positions THEN the system SHALL reject the placement with a clear error.
5. WHEN viewing a rack THEN the system SHALL display used U vs free U and power draw vs capacity.

### Requirement 3: Device & Rack-Unit Placement
**User Story:** As an IXP operator, I want to place devices (switches, patch panels, routers) into specific rack units, so that I know exactly where every piece of equipment is.

#### Acceptance Criteria
1. WHEN an admin adds a device THEN the system SHALL store its name, type (`switch` | `router` | `patch-panel` | `server` | `other`), vendor, model, serial number, height in U, and start U position.
2. THE system SHALL associate every device with exactly one rack.
3. WHEN a device type is `switch` or `router` THEN the system SHALL allow defining its physical ports.
4. THE system SHALL allow recording management IP, asset tag, and power draw for a device.
5. WHEN a device is moved or removed THEN the system SHALL free the previously occupied rack units.

### Requirement 4: Patch Panel & Port Management
**User Story:** As an IXP operator, I want to manage patch panels and their ports, so that cabling between members and switches is documented.

#### Acceptance Criteria
1. WHEN an admin creates a patch panel THEN the system SHALL store its port count and port labels/numbering.
2. THE system SHALL represent each physical port with a number/label, media type (`fiber-sm` | `fiber-mm` | `copper`), connector type (e.g. LC, SC, RJ45), and status (`free` | `connected` | `reserved` | `faulty`).
3. WHEN a port is connected via a cross-connect THEN the system SHALL mark it `connected` and link the two endpoints.
4. THE system SHALL allow filtering/searching ports by status, device, rack, or data center.

### Requirement 5: Cross-Connect & Cabling
**User Story:** As an IXP operator, I want to record cross-connects between ports, so that I can trace any physical path end to end.

#### Acceptance Criteria
1. WHEN an admin creates a cross-connect THEN the system SHALL link an A-end port and a Z-end port and store cable type, length, and label.
2. THE system SHALL prevent connecting a port that is already connected unless the existing connection is removed first.
3. WHEN viewing a connection or member THEN the system SHALL display the full physical path (member port → patch panel → switch port).
4. THE system SHALL allow marking a cross-connect as `planned`, `active`, or `decommissioned`.

### Requirement 6: Switch Port Capacity & Speeds
**User Story:** As an IXP operator, I want switch ports to carry speed and capacity data, so that I can plan growth.

#### Acceptance Criteria
1. THE system SHALL store per switch port: speed (`1G` | `10G` | `25G` | `40G` | `100G` | `400G`), media, and admin/operational status.
2. WHEN a member connection is bound to a switch port THEN the system SHALL mark the port as in-use and SHALL prevent double allocation.
3. WHEN viewing a switch THEN the system SHALL show free vs used ports grouped by speed.

### Requirement 7: Member Connections (Virtual Interfaces)
**User Story:** As an IXP operator, I want to link members to the physical infrastructure, so that each member's service is fully described.

#### Acceptance Criteria
1. THE system SHALL associate every member connection with exactly one `Organization`.
2. WHEN a connection is created THEN the system SHALL bind it to one or more physical switch ports (LAG support) and to a VLAN.
3. THE system SHALL replace/supersede the current `Port` model linkage that pointed to IXP Manager, migrating existing port records.
4. WHEN viewing an `Organization` in admin and in the member portal THEN the system SHALL display its connections, ports, speeds, VLAN, and assigned IPs.
5. THE system SHALL support connection states `requested`, `provisioning`, `active`, `suspended`, `decommissioned`.

### Requirement 8: VLAN & Peering LAN Management
**User Story:** As an IXP operator, I want to manage VLANs and peering LANs, so that members are placed on the correct segment.

#### Acceptance Criteria
1. WHEN an admin creates a VLAN THEN the system SHALL store its tag, name, IPv4 subnet, and IPv6 subnet.
2. THE system SHALL associate a VLAN with one infrastructure/data center scope.
3. WHEN a member connection joins a VLAN THEN the system SHALL allow assigning IPv4/IPv6 addresses from that VLAN's ranges.

### Requirement 9: IP Address Management (IPAM)
**User Story:** As an IXP operator, I want IP allocation from peering-LAN ranges, so that no address is double-assigned.

#### Acceptance Criteria
1. THE system SHALL track every IPv4 and IPv6 address in a VLAN range as `free`, `assigned`, or `reserved`.
2. WHEN an admin assigns an IP to a member connection THEN the system SHALL prevent assigning an already-assigned address.
3. WHEN a connection is decommissioned THEN the system SHALL release its IP addresses back to `free`.
4. THE system SHALL display utilization (assigned vs total) per VLAN.

### Requirement 10: Route Server & BGP Session Management
**User Story:** As an IXP operator, I want to manage route servers and member BGP sessions, so that peering is documented and config can be generated.

#### Acceptance Criteria
1. THE system SHALL reuse/extend the existing route-server data (ASN 141539) and associate route servers with VLANs.
2. WHEN a member connection is on a VLAN with a route server THEN the system SHALL allow recording a BGP session (peer IP, ASN, max-prefix, md5, RS-client flag).
3. THE system SHALL generate an exportable route-server config preview (e.g. BIRD-style) and member list WITHOUT pushing it live in this phase.
4. THE system SHALL surface BGP session status fields for display alongside Alice-LG data.

### Requirement 11: Capacity & Utilization Dashboard
**User Story:** As an IXP operator, I want capacity dashboards, so that I can plan expansion.

#### Acceptance Criteria
1. WHEN an admin opens the infrastructure dashboard THEN the system SHALL show totals: data centers, racks, devices, switch ports (free/used by speed), and member connections.
2. THE system SHALL show rack space utilization (U) and power utilization per data center.
3. THE system SHALL show peering-LAN IP utilization per VLAN.
4. THE system SHALL highlight capacity nearing limits (e.g. greater than 80% used).

### Requirement 12: Member Portal Visibility
**User Story:** As a member, I want to see my own connection details, so that I understand my service.

#### Acceptance Criteria
1. WHEN a member views the portal THEN the system SHALL display their connections, port speeds, location/data center, VLAN, and assigned IPv4/IPv6.
2. THE system SHALL NOT expose other members' physical placement, cabling, or rack details.
3. WHERE a connection is in `provisioning` THEN the portal SHALL show its status.

### Requirement 13: Orders to Provisioning Workflow
**User Story:** As an IXP operator, I want orders to drive provisioning, so that the flow is end-to-end inside MX-IX.

#### Acceptance Criteria
1. WHEN a port order is approved THEN the system SHALL allow creating a member connection and allocating a switch port, VLAN, and IPs from within the order screen.
2. WHEN provisioning completes THEN the system SHALL set the connection to `active` and reflect it in the member portal.
3. THE system SHALL record an audit-log entry for each provisioning action.

### Requirement 14: Role-Based Access Control
**User Story:** As an administrator, I want infrastructure actions restricted by role, so that only authorized staff make changes.

#### Acceptance Criteria
1. THE system SHALL restrict create/update/delete of infrastructure to `admin`, `super-admin`, and `noc` roles.
2. THE system SHALL allow read-only infrastructure access to other admin roles where appropriate.
3. THE system SHALL reuse the existing admin auth and audit-log mechanisms.

### Requirement 15: Migration & IXP Manager Decommission
**User Story:** As an operator, I want to migrate existing data, so that switching off IXP Manager loses nothing.

#### Acceptance Criteria
1. THE system SHALL provide a one-time import to pull existing members/ports (including from the current IXP Manager IX-F export) into the new models.
2. WHEN the in-house system is enabled THEN the platform SHALL function fully with the IXP Manager integration disabled.
3. THE system SHALL keep the existing `Organization`, `Location`, `Order`, and `Member` data intact and link to it rather than replace it.
4. THE system SHALL preserve the "Netlayer" organization (AS50839) and route-server ASN 141539 during migration.

### Requirement 16: Data Integrity & Validation
**User Story:** As an operator, I want strong validation, so that the inventory stays trustworthy.

#### Acceptance Criteria
1. THE system SHALL enforce referential integrity (no orphan devices/ports/connections) and block deletes that would orphan dependents.
2. IF a uniqueness rule is violated (duplicate rack U, duplicate IP, duplicate cross-connect endpoint) THEN the system SHALL reject the operation with a clear message.
3. THE system SHALL validate all inputs server-side and return descriptive errors.

### Requirement 17: Contacts & Contact Groups
**User Story:** As an IXP operator, I want structured contacts per member, so that the right person is reached for routing, billing or outage matters.

#### Acceptance Criteria
1. WHEN an admin adds a contact THEN the system SHALL store name, role, email, phone, and one or more groups (`noc` | `technical` | `billing` | `peering` | `escalation` | `admin`).
2. THE system SHALL associate every contact with exactly one `Organization`.
3. WHERE a notification targets a group THEN the system SHALL resolve recipients from that group's contacts.
4. IF an organisation has no `noc` contact THEN the system SHALL surface a warning on the member record.
5. THE system SHALL allow a member to maintain their own contacts from the portal.

### Requirement 18: Document Store
**User Story:** As an IXP operator, I want member documents held against the member record, so that agreements and LOAs are not scattered across email.

#### Acceptance Criteria
1. WHEN an admin uploads a document THEN the system SHALL store its filename, type (`agreement` | `loa` | `kyc` | `invoice` | `other`), size, uploader and upload time.
2. THE system SHALL support marking a document as member-visible or admin-only.
3. WHERE a document is member-visible THEN the portal SHALL allow that member to download it.
4. THE system SHALL prevent one member from accessing another member's documents.
5. THE system SHALL restrict uploads to an allow-list of file types and enforce a maximum size.

### Requirement 19: PeeringDB Integration
**User Story:** As an IXP operator, I want member data enriched from PeeringDB, so that I do not retype information the member already publishes.

#### Acceptance Criteria
1. WHEN an admin enters an ASN during member creation THEN the system SHALL look the ASN up in PeeringDB and offer name, prefix counts, IRR AS-SET, peering policy and contacts for import.
2. THE system SHALL cache PeeringDB responses with a synchronisation timestamp and SHALL NOT query the API on every page view.
3. THE system SHALL run a scheduled synchronisation and SHALL record when a member's declared IPv4/IPv6 prefix limits change.
4. IF a member's PeeringDB prefix limit differs materially from the configured max-prefix THEN the system SHALL raise a drift alert for review rather than changing configuration automatically.
5. WHERE PeeringDB is unreachable THEN the system SHALL continue using cached values and SHALL surface the stale state.
6. THE system SHALL store an operator-supplied PeeringDB API key in integration settings and SHALL mask it when returning settings to the client.

### Requirement 20: IRRDB Prefix Filtering
**User Story:** As an IXP operator, I want prefix filters built from IRR data, so that members can only announce prefixes they are authorised to announce.

#### Acceptance Criteria
1. THE system SHALL generate per-member IPv4 and IPv6 prefix sets from the member's AS-SET or ASN using an IRR query tool.
2. THE system SHALL persist the generated prefix sets with a generation timestamp and the source used.
3. WHEN a prefix-set refresh fails THEN the system SHALL retain the last known-good set, SHALL NOT emit an empty filter, and SHALL raise an alert.
4. THE system SHALL run prefix-set refreshes on a schedule and SHALL allow an on-demand refresh for a single member.
5. THE system SHALL display, per member, the prefix count and the age of the current set.

### Requirement 21: RPKI Route Origin Validation
**User Story:** As an IXP operator, I want RPKI validation applied at the route servers, so that invalid announcements are rejected.

#### Acceptance Criteria
1. THE system SHALL store the configured RPKI validator (RTR) endpoints used by the route servers.
2. THE generated route-server configuration SHALL apply origin validation and SHALL reject RPKI-invalid routes.
3. WHERE the validator is unreachable THEN the generated policy SHALL fail open (treat state as not-found) rather than rejecting all routes.
4. THE system SHALL report per-member counts of valid, invalid and not-found announcements for operator review.

### Requirement 22: Route Server Configuration Generation
**User Story:** As an IXP operator, I want route-server configuration generated from the database, so that adding a peer never means hand-editing config.

#### Acceptance Criteria
1. THE system SHALL generate BIRD configuration from member connections, VLANs, assigned IPs, BGP session records, generated prefix sets and policy defaults.
2. THE system SHALL emit one include file per member session plus a global configuration file, so a single member's change affects a single file.
3. THE generated configuration SHALL include, per session: peer IP, peer ASN, max-prefix limit with an action, prefix filters, RPKI policy, optional MD5, and the exchange's BGP community scheme.
4. THE system SHALL support more than one route server and SHALL generate configuration per route-server instance.
5. THE system SHALL store every generated configuration as an immutable revision with author, timestamp and the input state summary.
6. THE system SHALL allow downloading any revision without deploying it.

### Requirement 23: Configuration Validation & Approval
**User Story:** As an IXP operator, I want generated configuration checked and reviewed before it reaches a route server, so that a mistake cannot take the fabric down.

#### Acceptance Criteria
1. BEFORE any deployment THE system SHALL validate the candidate configuration with the target daemon's parser and SHALL block deployment on parse failure.
2. THE system SHALL run policy checks and SHALL block deployment when a session lacks a prefix filter or a max-prefix limit.
3. THE system SHALL present a line-level diff between the candidate configuration and the currently deployed revision.
4. IF the diff removes or disables an existing session THEN the system SHALL require explicit confirmation naming the affected members.
5. THE system SHALL require an approving admin with `admin`, `super-admin` or `noc` role, and SHALL record who approved what.
6. WHERE the diff removes sessions THEN the system SHALL require an approver different from the author.

### Requirement 24: Configuration Deployment & Rollback
**User Story:** As an IXP operator, I want approved configuration delivered and reloaded safely, so that peers are added without disturbing existing sessions.

#### Acceptance Criteria
1. THE system SHALL deliver configuration to each route-server host through an authenticated agent endpoint and SHALL NOT require interactive shell access from the application.
2. THE system SHALL apply configuration atomically and SHALL trigger a graceful reload that does not reset established sessions.
3. WHERE a hard reload is unavoidable THEN the system SHALL require a separate, explicit operator action.
4. THE system SHALL retain a configurable number of previous revisions on each host to allow immediate rollback.
5. AFTER deployment THE system SHALL verify session state and SHALL automatically roll back when established sessions drop beyond a configured threshold.
6. THE system SHALL record every deployment attempt with outcome, duration, and verification result in the audit log.
7. THE system SHALL support a dry-run mode that performs generation, validation and diff without deploying.

### Requirement 25: MAC Address Management
**User Story:** As an IXP operator, I want member MAC addresses recorded, so that port security and layer-2 hygiene can be enforced.

#### Acceptance Criteria
1. THE system SHALL allow one or more MAC addresses per member connection.
2. THE system SHALL validate MAC format and SHALL reject a MAC already recorded on a different connection within the same VLAN.
3. THE system SHALL include recorded MAC addresses in generated switch port configuration where port security is enabled.
4. THE portal SHALL display a member's own recorded MAC addresses.

### Requirement 26: Quarantine Provisioning Workflow
**User Story:** As an IXP operator, I want new connections tested in isolation, so that a misconfigured member cannot disrupt production peers.

#### Acceptance Criteria
1. THE system SHALL allow designating a VLAN as the quarantine segment.
2. WHEN a connection is created THEN the system SHALL allow placing it in quarantine before production.
3. WHILE a connection is in quarantine THE system SHALL NOT include it in production route-server configuration.
4. THE system SHALL record quarantine test results and SHALL require them to pass before promotion.
5. WHEN a connection is promoted THEN the system SHALL reassign the VLAN, reallocate addressing if required, and regenerate configuration.

### Requirement 27: Switch Port Configuration Generation
**User Story:** As an IXP operator, I want switch port configuration generated per vendor, so that engineers apply consistent, reviewed configuration.

#### Acceptance Criteria
1. THE system SHALL generate port configuration for a member connection targeting the switch's vendor and operating system.
2. THE system SHALL support at least one template per vendor family in use at the exchange.
3. THE generated output SHALL include description, VLAN membership, LAG grouping where applicable, and port security when MACs are recorded.
4. THE system SHALL clearly mark generated switch configuration as requiring manual application in this phase.

### Requirement 28: Monitoring Auto-Provisioning
**User Story:** As an IXP operator, I want monitoring created with the connection, so that graphs and alerts exist from day one.

#### Acceptance Criteria
1. WHEN a connection becomes active THEN the system SHALL create or update the corresponding monitoring host and interface mapping in the configured monitoring system.
2. THE system SHALL store the resulting monitoring identifiers on the connection for later metric queries.
3. IF monitoring provisioning fails THEN the system SHALL complete activation, flag the connection as unmonitored, and raise a task.
4. WHEN a connection is decommissioned THEN the system SHALL disable or remove its monitoring entry.
5. THE system SHALL register new route servers as Looking Glass sources.

### Requirement 29: IX-F Member Export & Public API
**User Story:** As an IXP operator, I want machine-readable exchange data published, so that PeeringDB and member automation can consume it.

#### Acceptance Criteria
1. THE system SHALL publish an IX-F Member Export document describing the exchange, its infrastructures, VLANs and member connections.
2. THE export SHALL be reachable without authentication at a stable URL and SHALL exclude commercial and physical-placement data.
3. THE export SHALL reflect only connections in an active state.
4. THE system SHALL provide a documented read API for member-facing resources.

### Requirement 30: Peering Matrix & Traffic Analytics
**User Story:** As an IXP operator, I want to see who exchanges traffic with whom, so that I can advise members and plan capacity.

#### Acceptance Criteria
1. WHERE flow data is available THE system SHALL present a member-to-member traffic matrix for a selected period.
2. THE system SHALL show, per member, top traffic counterparties.
3. THE system SHALL NOT expose another member's identifiable counterparty volumes to a member in the portal unless both consent.
4. WHERE flow data is unavailable THEN the system SHALL clearly indicate that the matrix is unavailable rather than showing fabricated figures.

### Requirement 31: 95th-Percentile Billing Export
**User Story:** As a billing operator, I want usage figures produced automatically, so that invoicing does not depend on manual graph reading.

#### Acceptance Criteria
1. THE system SHALL compute per-connection and per-member 95th-percentile traffic for a billing period.
2. THE system SHALL produce a reviewable billing run that an operator approves before it reaches the accounting system.
3. THE system SHALL retain historical billing runs and their figures for dispute resolution.
4. WHERE metric data is incomplete for a period THEN the system SHALL flag the affected members instead of billing an understated figure.

### Requirement 32: Member API Keys
**User Story:** As a member, I want programmatic access to my own data, so that I can automate against the exchange.

#### Acceptance Criteria
1. THE system SHALL allow a member administrator to create and revoke API keys scoped to that member.
2. THE system SHALL display a key's secret only once at creation and SHALL store only a hash.
3. THE system SHALL restrict API keys to read access to the member's own resources in this phase.
4. THE system SHALL record last-used time per key and SHALL apply rate limiting.

### Requirement 33: Maintenance Windows
**User Story:** As an IXP operator, I want maintenance planned and communicated, so that members are not surprised.

#### Acceptance Criteria
1. WHEN an operator schedules maintenance THEN the system SHALL record the window, affected components, expected impact and description.
2. THE system SHALL notify affected members through their configured notification groups.
3. THE portal SHALL show a member only the maintenance affecting their own connections or locations.
4. THE system SHALL publish scheduled maintenance to the public status page.
5. WHILE maintenance is active THE system SHALL suppress dependent alerts for the affected components.

### Requirement 34: Suspension & Offboarding
**User Story:** As an IXP operator, I want controlled suspension and clean offboarding, so that resources are reclaimed and nothing is left dangling.

#### Acceptance Criteria
1. WHEN a member is suspended THEN the system SHALL support disabling their sessions while retaining their configuration and allocations.
2. WHEN a suspension is lifted THEN the system SHALL restore sessions without re-provisioning.
3. WHEN a member is offboarded THEN the system SHALL withdraw sessions, release IP allocations, mark cross-connects for removal, free switch ports, and disable monitoring.
4. THE system SHALL retain the member record, documents and billing history after offboarding.
5. THE system SHALL require explicit confirmation before releasing resources and SHALL log every released item.

### Requirement 35: Core Bundles & Inter-Switch Links
**User Story:** As an IXP operator, I want fabric interconnects modelled, so that fabric capacity is visible.

#### Acceptance Criteria
1. THE system SHALL allow defining a link between two switches composed of one or more physical port pairs.
2. THE system SHALL calculate aggregate capacity per link and SHALL reserve the member ports it consumes.
3. THE system SHALL display fabric topology and per-link utilisation where metrics are available.

### Requirement 36: Console Server Management
**User Story:** As an IXP operator, I want out-of-band access documented, so that engineers can reach devices during an outage.

#### Acceptance Criteria
1. THE system SHALL allow recording console servers and mapping their ports to managed devices.
2. THE system SHALL restrict visibility of console access details to `admin`, `super-admin` and `noc` roles.
3. THE system SHALL NOT store console passwords in plain text.

### Requirement 37: Configuration Drift Detection
**User Story:** As an IXP operator, I want to know when a device's running configuration differs from what MX-IX generated, so that undocumented changes are caught.

#### Acceptance Criteria
1. THE system SHALL periodically compare the deployed route-server configuration against the current generated output.
2. WHEN drift is detected THEN the system SHALL raise an alert identifying the affected route server and the differing sections.
3. THE system SHALL record drift history so recurring manual changes are visible.

### Requirement 38: Operational Dashboards & Reports
**User Story:** As an IXP operator, I want the daily and periodic views described in Flow C, so that operations do not rely on memory.

#### Acceptance Criteria
1. THE system SHALL provide a daily operations view listing sessions down, errored ports, open orders, open tickets, pending peering requests and pending blackhole requests.
2. THE system SHALL provide capacity reports for switch ports by speed and location, rack space, power and IP pool utilisation.
3. THE system SHALL provide reports for RPKI-invalid announcements, members near max-prefix, stale IRR prefix sets, free ports, and planned-versus-active cross-connects.
4. THE system SHALL provide per-member availability reporting for a selected period.
5. THE system SHALL allow exporting any report as CSV.
