# MX-IX Frontend - Infrastructure Evolved

## Project Summary / Overview

MX-IX (Matrix Internet Exchange) is a next-generation Internet Exchange platform designed to redefine the physical layer of the internet. This frontend control panel provides real-time visibility into the global network fabric, offering advanced telemetry, automated provisioning, and a "God-mode" view of the infrastructure.

The interface is built with a "sci-fi industrial" aesthetic, utilizing a stark black, white, and red color palette, glassmorphism effects, and fluid animations to convey a sense of precision and high-tech capability. It serves both public users (marketing, service discovery) and internal administrators (network management, stats overrides).

Key capabilities include:
*   **Global Visualization**: Interactive maps and 3D globes showing Point of Presence (PoP) locations.
*   **Real-time Telemetry**: Live traffic graphs and capacity indicators integrated with Grafana/Zabbix.
*   **Service Catalog**: Detailed breakdown of peering, cloud connect, and colocation services.
*   **Admin Control**: A secured dashboard for managing location data and overriding global statistics.

---

## Features (Per Page)

### 1. Global Components
*   **Navigation Bar**: Responsive design with glassmorphism effects transparent-to-white on scroll. Includes a "System Status" pulsing indicator.
*   **Mobile Menu**: Slide-in overlay with full navigation and resource links.
*   **Footer**: Rich layout with carbon fibre texture background, "System Optimal" indicator, and quick links.
*   **Custom Cursor**: A "red circle follower" reactive cursor that expands on hover, enhancing the immersive feel.

### 2. Home Page (`/`)
*   **Hero Section**: Split layout featuring a large typographic statement ("INFRA STRUCTURE EVOLVED") and an interactive Network Map.
*   **Stats Strip**: 3-column grid displaying Location count, Connected Data Centers, and Total Capacity with hover interactions.
*   **Real-Time Capacity**: A dedicated section simulating (or displaying live) traffic waves and throughput metrics.
*   **Global Fabric**: An interactive map visualization showing the layout of the global network.

### 3. Services Page (`/services`)
*   **Hero Section**: Static carbon fibre background with a stats overlay.
*   **Service Catalog**: Accordion-style list of services (Peering, Cloud Connect, etc.).
*   **Split View Details**: Expanding a service reveals key benefits and technical specifications side-by-side.

### 4. Locations Page (`/locations`)
*   **Hero Section**: Features a static globe image and a "Global Presence" badge.
*   **Main Interface**: A split-screen layout.
    *   **Left**: Accordion sidebar grouped by continent for selecting cities.
    *   **Right**: Detail panel showing connected networks, routes, and a specific Traffic Graph for the selected city.
*   **Data Source**: Hybrid model using hardcoded fallbacks and dynamic data from the Admin Context.

### 5. Stats Page (`/stats`)
*   **Hero Section**: Controls for toggling between "Live" and "Simulated" data sources.
*   **Traffic Overview**: Gradient-styled cards for Inbound, Outbound, and Peak traffic.
*   **Main Graph**: Large area chart visualizing network throughput.
*   **Detailed Metrics**: Grid showing Packet Loss, Jitter, and Latency with trend indicators.

### 6. About Page (`/about`)
*   **Hero Section**: Simple "Our Story" header.
*   **Timeline**: Visual stats for "Founded", "Countries", and "Clients".
*   **Technology Cards**: Grid layout highlighting AI Routing, Low Latency, and Security features.

### 7. Contact Page (`/contact`)
*   **Dynamic Form**: A smart form that adapts based on the selected department (Sales vs. Tech Support).
*   **Conditional Fields**: Dropdowns change based on service type (e.g., Cloud Connect shows AWS/Azure options; Peering shows ASN fields).
*   **Email Integration**: Connected via `emailjs` for direct submission.

### 8. Admin Pages (`/admin`)
*   **Dashboard**: Secure login and overview stats.
*   **Locations Panel**: Full CRUD (Create, Read, Update, Delete) capabilities for managing global locations.
*   **Stats Controls**: Manual override fields to adjust "Global Latency" or "Active Nodes" for marketing purposes.

---

## Design System

### Fonts & Typography
The typography is designed to be technical, legible, and impactful.
*   **Primary Font**: `Inter` (Google Fonts) - Used for body text, UI elements, and headings.
*   **Monospace Font**: System Monospace / `JetBrains Mono` style - Used for technical data, stats, and "code-like" labels.

### Color Codes
*   **Brand Red**: `#F20732` (Primary Accent - Alerts, Hovers, "Live" indicators)
*   **Background**: `#FFFFFF` (White - Main Clean Look), `#000000` (Black - Footer, High Contast)
*   **Grays**: Slate scale (Tailwind `slate-500` to `slate-950`) for technical text and dark mode elements.
*   **Status Green**: `#22c55e` (Tailwind `green-500`) for "Operational" status.

### Icons & Illustrations
*   **Icon Set**: `lucide-react` (Feather icons) - Clean, stroke-based icons.
*   **Custom Graphics**:
    *   `HeroNetworkMap`: Custom dot-matrix world map.
    *   Carbon Fibre Patterns: CSS-based or texture overlays (`transparenttextures.com`).

---

## Environment Details

### Tech Stack
*   **Framework**: [React](https://react.dev/) (v18+)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Animation**: CSS Keyframes + React Hooks for JS animations.
*   **Maps**: `react-simple-maps`

### Dependencies
*   `lucide-react`: Iconography.
*   `@emailjs/browser`: Contact form submission.
*   `react-router-dom` (implied): Navigation handling.

---

## GitHub Repository
[Wonder-Creative-Studio/MX-IX_frontend](https://github.com/Wonder-Creative-Studio/MX-IX_frontend)

---

> **Note**: This documentation reflects the current state of the frontend architecture. For backend integration details, refer to the separate backend documentation.
