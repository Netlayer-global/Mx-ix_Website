import { Request, Response } from 'express';
import { Location } from '../models';

// Get all locations
export const getAllLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, region, continentId } = req.query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (region) filter.region = region;
    if (continentId) filter.continentId = continentId;

    const locations = await Location.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      data: locations.map(l => ({
        id: l.id,
        name: l.name,
        coordinates: l.coordinates,
        code: l.code,
        region: l.region,
        asns: l.asns,
        sites: l.sites,
        asnList: l.asnList,
        enabledSites: l.enabledSites,
        status: l.status,
        // Extended fields
        country: l.country,
        continentId: l.continentId,
        latency: l.latency,
        datacenter: l.datacenter,
        address: l.address,
        ixName: l.ixName,
        peers: l.peers,
        capacity: l.capacity,
        portSpeeds: l.portSpeeds,
        protocols: l.protocols,
        features: l.features,
        description: l.description,
        established: l.established,
        cityImage: l.cityImage,
        pricing: l.pricing,
        routeServers: l.routeServers,
        uptime: l.uptime,
        ipv4Routes: l.ipv4Routes,
        ipv6Routes: l.ipv6Routes,
      })),
    });

  } catch (error) {
    console.error('Get all locations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get locations',
    });
  }
};


// Get single location
export const getLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: location.id,
        name: location.name,
        coordinates: location.coordinates,
        code: location.code,
        region: location.region,
        asns: location.asns,
        sites: location.sites,
        asnList: location.asnList,
        enabledSites: location.enabledSites,
        status: location.status,
        // Extended fields
        country: location.country,
        continentId: location.continentId,
        latency: location.latency,
        datacenter: location.datacenter,
        address: location.address,
        ixName: location.ixName,
        peers: location.peers,
        capacity: location.capacity,
        portSpeeds: location.portSpeeds,
        protocols: location.protocols,
        features: location.features,
        description: location.description,
        established: location.established,
        cityImage: location.cityImage,
        pricing: location.pricing,
        routeServers: location.routeServers,
        uptime: location.uptime,
        ipv4Routes: location.ipv4Routes,
        ipv6Routes: location.ipv6Routes,
      },
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get location',
    });
  }
};


// Create location
import fs from 'fs';
export const createLocation = async (req: Request, res: Response): Promise<void> => {
  try {

    const { 
      id, name, coordinates, code, region, asnList, enabledSites, status,
      country, continentId, latency, datacenter, address, ixName, 
      capacity, portSpeeds, protocols, features, description, established, cityImage, pricing, routeServers,
      ipv4Routes, ipv6Routes
    } = req.body;

    if (!id || !name || !coordinates || !code || !region) {
      res.status(400).json({
        success: false,
        error: 'id, name, coordinates, code, and region are required',
      });
      return;
    }

    // Check if location with this id already exists
    const existing = await Location.findOne({ id });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Location with this ID already exists',
      });
      return;
    }

    const location = await Location.create({
      id,
      name,
      coordinates,
      code,
      region,
      asnList: asnList || [],
      enabledSites: enabledSites || [],
      status: status || 'current',
      country, continentId, latency, datacenter, address, ixName, 
      capacity, 
      portSpeeds: portSpeeds || ['1G', '10G', '40G', '100G'], 
      protocols: protocols || ['BGP-4', 'IPv4', 'IPv6'], 
      features: features || [], 
      description, established, cityImage, 
      pricing: pricing || [],
      routeServers: routeServers || [],
      uptime: '100 %',
      ipv4Routes: ipv4Routes || '',
      ipv6Routes: ipv6Routes || '',
    });



    res.status(201).json({
      success: true,
      data: {
        id: location.id,
        name: location.name,
        coordinates: location.coordinates,
        code: location.code,
        region: location.region,
        asns: location.asns,
        sites: location.sites,
        asnList: location.asnList,
        enabledSites: location.enabledSites,
        status: location.status,
        country: location.country,
        continentId: location.continentId,
        latency: location.latency,
        datacenter: location.datacenter,
        address: location.address,
        ixName: location.ixName,
        peers: location.peers,
        capacity: location.capacity,
        portSpeeds: location.portSpeeds,
        protocols: location.protocols,
        features: location.features,
        description: location.description,
        established: location.established,
        cityImage: location.cityImage,
        pricing: location.pricing,
        routeServers: location.routeServers,
        uptime: location.uptime,
        ipv4Routes: location.ipv4Routes,
        ipv6Routes: location.ipv6Routes,
      },
      message: 'Location created successfully',
    });
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create location',
    });
  }
};

// Update location
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    // Update allowed fields
    const allowedUpdates = [
      'name', 'coordinates', 'code', 'region', 'asnList', 'enabledSites', 'status',
      'country', 'continentId', 'latency', 'datacenter', 'address', 'ixName', 
      'peers', 'capacity', 'portSpeeds', 'protocols', 'features', 
      'description', 'established', 'cityImage', 'pricing', 'routeServers', 'uptime',
      'ipv4Routes', 'ipv6Routes'
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        (location as any)[field] = updates[field];
      }
    });

    await location.save();

    res.json({
      success: true,
      data: {
        id: location.id,
        name: location.name,
        coordinates: location.coordinates,
        code: location.code,
        region: location.region,
        asns: location.asns,
        sites: location.sites,
        asnList: location.asnList,
        enabledSites: location.enabledSites,
        status: location.status,
        country: location.country,
        continentId: location.continentId,
        latency: location.latency,
        datacenter: location.datacenter,
        address: location.address,
        ixName: location.ixName,
        peers: location.peers,
        capacity: location.capacity,
        portSpeeds: location.portSpeeds,
        protocols: location.protocols,
        features: location.features,
        description: location.description,
        established: location.established,
        cityImage: location.cityImage,
        pricing: location.pricing,
        routeServers: location.routeServers,
        uptime: location.uptime,
        ipv4Routes: location.ipv4Routes,
        ipv6Routes: location.ipv6Routes,
      },
      message: 'Location updated successfully',
    });
  } catch (error: any) {
    console.error('Update location error:', error);
    console.error('Validation errors:', error.errors);
    res.status(500).json({
      success: false,
      error: 'Failed to update location',
      details: error.message,
      validationErrors: error.errors
    });
  }
};

// Delete location
export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const location = await Location.findOneAndDelete({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete location',
    });
  }
};

// ========================
// ASN Management
// ========================

// Get ASNs for location
export const getLocationASNs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    res.json({
      success: true,
      data: location.asnList,
    });
  } catch (error) {
    console.error('Get location ASNs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ASNs',
    });
  }
};

// Add ASN to location
export const addASN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { asnNumber, name, macro, peeringPolicy, status } = req.body;

    if (!asnNumber || !name) {
      res.status(400).json({
        success: false,
        error: 'asnNumber and name are required',
      });
      return;
    }

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    // Check if ASN already exists
    const existingASN = location.asnList.find(a => a.asnNumber === asnNumber);
    if (existingASN) {
      res.status(409).json({
        success: false,
        error: 'ASN already exists in this location',
      });
      return;
    }

    location.asnList.push({
      asnNumber,
      name,
      macro: macro || '',
      peeringPolicy: peeringPolicy || 'Open',
      status: status || 'ACTIVE',
    });

    await location.save();

    res.status(201).json({
      success: true,
      data: location.asnList,
      message: 'ASN added successfully',
    });
  } catch (error) {
    console.error('Add ASN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add ASN',
    });
  }
};

// Update ASN
export const updateASN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, asnNumber } = req.params;
    const updates = req.body;

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    const asnIndex = location.asnList.findIndex(a => a.asnNumber === parseInt(asnNumber as string, 10));
    if (asnIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'ASN not found in this location',
      });
      return;
    }

    // Update ASN fields
    const asn = location.asnList[asnIndex];
    if (updates.name !== undefined) asn.name = updates.name;
    if (updates.macro !== undefined) asn.macro = updates.macro;
    if (updates.peeringPolicy !== undefined) asn.peeringPolicy = updates.peeringPolicy;
    if (updates.status !== undefined) asn.status = updates.status;

    await location.save();

    res.json({
      success: true,
      data: location.asnList,
      message: 'ASN updated successfully',
    });
  } catch (error) {
    console.error('Update ASN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ASN',
    });
  }
};

// Delete ASN
export const deleteASN = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, asnNumber } = req.params;

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    const asnIndex = location.asnList.findIndex(a => a.asnNumber === parseInt(asnNumber as string, 10));
    if (asnIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'ASN not found in this location',
      });
      return;
    }

    location.asnList.splice(asnIndex, 1);
    await location.save();

    res.json({
      success: true,
      data: location.asnList,
      message: 'ASN deleted successfully',
    });
  } catch (error) {
    console.error('Delete ASN error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ASN',
    });
  }
};

// ========================
// Enabled Sites Management
// ========================

// Get sites for location
export const getLocationSites = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    res.json({
      success: true,
      data: location.enabledSites,
    });
  } catch (error) {
    console.error('Get location sites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sites',
    });
  }
};

// Add site to location
export const addSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { id: siteId, name, provider, address, status } = req.body;

    if (!siteId || !name || !provider || !address) {
      res.status(400).json({
        success: false,
        error: 'id, name, provider, and address are required',
      });
      return;
    }

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    // Check if site already exists
    const existingSite = location.enabledSites.find(s => s.id === siteId);
    if (existingSite) {
      res.status(409).json({
        success: false,
        error: 'Site with this ID already exists in this location',
      });
      return;
    }

    location.enabledSites.push({
      id: siteId,
      name,
      provider,
      address,
      status: status || 'available',
    });

    await location.save();

    res.status(201).json({
      success: true,
      data: location.enabledSites,
      message: 'Site added successfully',
    });
  } catch (error) {
    console.error('Add site error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add site',
    });
  }
};

// Update site
export const updateSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, siteId } = req.params;
    const updates = req.body;

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    const siteIndex = location.enabledSites.findIndex(s => s.id === siteId);
    if (siteIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Site not found in this location',
      });
      return;
    }

    // Update site fields
    const site = location.enabledSites[siteIndex];
    if (updates.name !== undefined) site.name = updates.name;
    if (updates.provider !== undefined) site.provider = updates.provider;
    if (updates.address !== undefined) site.address = updates.address;
    if (updates.status !== undefined) site.status = updates.status;

    await location.save();

    res.json({
      success: true,
      data: location.enabledSites,
      message: 'Site updated successfully',
    });
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update site',
    });
  }
};

// Delete site
export const deleteSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, siteId } = req.params;

    const location = await Location.findOne({ id });

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
      });
      return;
    }

    const siteIndex = location.enabledSites.findIndex(s => s.id === siteId);
    if (siteIndex === -1) {
      res.status(404).json({
        success: false,
        error: 'Site not found in this location',
      });
      return;
    }

    location.enabledSites.splice(siteIndex, 1);
    await location.save();

    res.json({
      success: true,
      data: location.enabledSites,
      message: 'Site deleted successfully',
    });
  } catch (error) {
    console.error('Delete site error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete site',
    });
  }
};

export default {
  getAllLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationASNs,
  addASN,
  updateASN,
  deleteASN,
  getLocationSites,
  addSite,
  updateSite,
  deleteSite,
};
