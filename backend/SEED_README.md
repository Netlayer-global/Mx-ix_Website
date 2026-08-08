# Database Seed Script

This script initializes the MX-IX database with sample data for quick deployment and testing.

## What it does

The seed script populates the database with:

- **3 Continents**: Asia Pacific, Europe, North America
- **3 Locations**: Singapore, Frankfurt, New York (with facilities, ASNs, pricing tiers, and stats)
- **3 Service Categories**: Peering, Cloud, Security (with multiple service items each)
- **2 Contact Records**: Global sales and support contact information

## Usage

### Prerequisites

1. Make sure MongoDB is running
2. Ensure your `.env` file has the correct `MONGODB_URI`

### Running the seed

From the backend directory:

```bash
npm run seed
```

### What happens

1. ✅ Connects to MongoDB
2. 🗑️  Clears all existing data (Services, Continents, Locations, Contacts)
3. 🌱 Seeds new data
4. 📊 Shows a summary of created records
5. 👋 Disconnects from MongoDB

## When to use

- **Initial deployment**: Set up the database with sample data
- **Testing**: Reset to a known state
- **Development**: Quickly populate data after database wipes
- **Demos**: Show the system with realistic data

## Customizing the data

Edit `src/seed.ts` to modify:

- Continent names and order
- Location details (cities, coordinates, facilities, pricing)
- Service categories and items
- Contact information

## Warning

⚠️ **This script deletes all existing data before seeding!**

Only run this on:
- Fresh databases
- Development environments
- When you explicitly want to reset all data

**DO NOT run on production databases with real data!**

## Example output

```
🌱 Starting database seed...
📡 Connecting to MongoDB: mongodb://localhost:27017/mx-ix
✅ Connected to MongoDB

🗑️  Clearing existing data...
✅ Cleared existing data

🌍 Seeding continents...
✅ Created 3 continents

📍 Seeding locations...
✅ Created 3 locations

🔧 Seeding services...
✅ Created 3 services

📞 Seeding contacts...
✅ Created 2 contacts

🎉 Database seeded successfully!

📊 Summary:
   - Continents: 3
   - Locations: 3
   - Services: 3
   - Contacts: 2

👋 Disconnected from MongoDB
```

## Troubleshooting

### Connection errors

- Check if MongoDB is running
- Verify `MONGODB_URI` in `.env`
- Ensure network connectivity

### Import errors

- Run `npm install` to ensure all dependencies are installed
- Check that TypeScript is properly configured

### Data not appearing

- Check the admin panel after seeding
- Verify the backend is running
- Check browser console for API errors
