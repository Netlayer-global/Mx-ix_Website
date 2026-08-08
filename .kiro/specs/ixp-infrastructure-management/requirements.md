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

### Non-Goals (this phase)
- Auto-pushing live configuration to physical switches (config *generation/export* is in scope; automated push is a later phase).
- Generating production BIRD route-server configs that go live automatically (export/preview only this phase).
- Billing changes (the existing Zoho Books flow is unaffected).

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
