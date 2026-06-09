# MX-IX Admin Panel Backend

A reusable, template-based backend for content management systems. Built with Node.js, Express, TypeScript, and MongoDB.

## Features

- 🔐 **JWT Authentication** - Secure admin login
- 📊 **Network Stats API** - Manage network statistics
- 🌍 **Locations API** - Full CRUD with nested ASNs and Sites
- 🛠️ **Services API** - Manage services with nested items
- 📞 **Contacts API** - Contact information management
- 🌱 **Auto-seeding** - Automatic initial data population
- 📝 **TypeScript** - Type-safe development
- 🔄 **Reusable** - Easy to adapt for other projects

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas cluster)

### Installation

```bash
# Clone / navigate to the backend directory
cd MX-IX_backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your MongoDB URI
```

### Development

```bash
# Start MongoDB locally (if using local)
mongod

# Start development server with hot reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/password` | Change password |

### Network Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/network-stats` | Get stats (public) |
| PUT | `/api/network-stats` | Update stats (auth) |

### Global Fabric Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/global-fabric-stats` | Get stats (public) |
| PUT | `/api/global-fabric-stats` | Update stats (auth) |

### Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | List all services |
| GET | `/api/services/:id` | Get single service |
| POST | `/api/services` | Create service (auth) |
| PUT | `/api/services/:id` | Update service (auth) |
| DELETE | `/api/services/:id` | Delete service (auth) |
| POST | `/api/services/:id/items` | Add item (auth) |
| PUT | `/api/services/:id/items/:idx` | Update item (auth) |
| DELETE | `/api/services/:id/items/:idx` | Delete item (auth) |

### Locations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/locations` | List all locations |
| GET | `/api/locations/:id` | Get single location |
| POST | `/api/locations` | Create location (auth) |
| PUT | `/api/locations/:id` | Update location (auth) |
| DELETE | `/api/locations/:id` | Delete location (auth) |
| **ASNs** | | |
| GET | `/api/locations/:id/asns` | List ASNs |
| POST | `/api/locations/:id/asns` | Add ASN (auth) |
| PUT | `/api/locations/:id/asns/:asn` | Update ASN (auth) |
| DELETE | `/api/locations/:id/asns/:asn` | Delete ASN (auth) |
| **Sites** | | |
| GET | `/api/locations/:id/sites` | List sites |
| POST | `/api/locations/:id/sites` | Add site (auth) |
| PUT | `/api/locations/:id/sites/:siteId` | Update site (auth) |
| DELETE | `/api/locations/:id/sites/:siteId` | Delete site (auth) |

### Contacts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List all contacts |
| GET | `/api/contacts/:dept/:loc` | Get specific contact |
| PUT | `/api/contacts/:dept/:loc` | Update contact (auth) |

## Default Admin Credentials

```
Email: admin@mx-ix.com
Password: admin123
```

⚠️ **Change these in production!**

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection | mongodb://localhost:27017/mx-ix-admin |
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_EXPIRES_IN` | Token expiration | 7d |
| `FRONTEND_URL` | CORS origin | http://localhost:5173 |

## Reusing for Other Projects

1. **Clone this backend**
2. **Update `.env`** with new database name
3. **Modify models** in `src/models/` as needed
4. **Update seed data** in `src/services/seed.service.ts`
5. **Adjust routes** if adding/removing features

## Project Structure

```
src/
├── config/          # Environment & database config
├── controllers/     # Request handlers
├── middleware/      # Auth & error handling
├── models/          # MongoDB schemas
├── routes/          # API route definitions
├── services/        # Business logic & seeding
├── types/           # TypeScript interfaces
└── app.ts           # Express entry point
```

## License

MIT - Feel free to use and modify for your projects.
