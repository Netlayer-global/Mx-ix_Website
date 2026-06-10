import { Request, Response } from 'express';
import { PeeringRequest, Organization } from '../models';
import { notify } from '../services/notification.service';

/**
 * GET /api/portal/peering/policy
 * The org's own peering policy details.
 */
export const getPolicy = async (req: Request, res: Response): Promise<void> => {
  const org = req.organization!;
  res.json({
    success: true,
    data: {
      peeringPolicy: org.peeringPolicy,
      peeringPolicyUrl: org.peeringPolicyUrl || '',
      peeringNotes: org.peeringNotes || '',
      asn: org.asn,
      additionalAsns: org.additionalAsns,
    },
  });
};

/**
 * PUT /api/portal/peering/policy   { peeringPolicy, peeringPolicyUrl, peeringNotes }
 * Self-service peering policy (admin/viewer can update — gate at route if needed).
 */
export const updatePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { peeringPolicy, peeringPolicyUrl, peeringNotes } = req.body;
    const org = await Organization.findById(req.organization!._id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Organization not found.' });
      return;
    }
    if (peeringPolicy && ['Open', 'Selective', 'Restrictive'].includes(peeringPolicy)) {
      org.peeringPolicy = peeringPolicy;
    }
    if (peeringPolicyUrl !== undefined) org.peeringPolicyUrl = String(peeringPolicyUrl).trim();
    if (peeringNotes !== undefined) org.peeringNotes = String(peeringNotes).trim();
    await org.save();
    res.json({
      success: true,
      data: {
        peeringPolicy: org.peeringPolicy,
        peeringPolicyUrl: org.peeringPolicyUrl,
        peeringNotes: org.peeringNotes,
      },
    });
  } catch (error) {
    console.error('Update policy error:', error);
    res.status(500).json({ success: false, error: 'Failed to update policy.' });
  }
};

/**
 * GET /api/portal/peering/networks
 * Other active member networks (with ASN) to discover for bilateral peering.
 */
export const getNetworks = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgs = await Organization.find({
      _id: { $ne: req.organization!._id },
      status: 'active',
      asn: { $ne: null, $exists: true },
    })
      .select('name asn type peeringPolicy locations website')
      .sort({ name: 1 })
      .lean();
    res.json({
      success: true,
      data: orgs.map((o) => ({
        id: o._id,
        name: o.name,
        asn: o.asn,
        type: o.type,
        peeringPolicy: o.peeringPolicy,
        locations: o.locations,
        website: o.website,
      })),
    });
  } catch (error) {
    console.error('Get networks error:', error);
    res.status(500).json({ success: false, error: 'Failed to load networks.' });
  }
};

/**
 * GET /api/portal/peering/requests
 * Bilateral requests where this org is sender or recipient.
 */
export const listRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.organization!._id;
    const reqs = await PeeringRequest.find({ $or: [{ fromOrg: orgId }, { toOrg: orgId }] })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: reqs.map((r) => ({
        id: r._id,
        direction: String(r.fromOrg) === String(orgId) ? 'outgoing' : 'incoming',
        fromAsn: r.fromAsn,
        toAsn: r.toAsn,
        toName: r.toName,
        status: r.status,
        message: r.message,
        responseMessage: r.responseMessage,
        locations: r.locations,
        respondedAt: r.respondedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('List peering requests error:', error);
    res.status(500).json({ success: false, error: 'Failed to load requests.' });
  }
};

/**
 * POST /api/portal/peering/requests   { toAsn, toName?, message?, locations? }
 */
export const createRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    const { toAsn, toName, message, locations } = req.body;
    if (!toAsn) {
      res.status(400).json({ success: false, error: 'Target ASN is required.' });
      return;
    }
    const targetAsn = Number(toAsn);
    if (org.asn === targetAsn || (org.additionalAsns || []).includes(targetAsn)) {
      res.status(400).json({ success: false, error: 'You cannot request peering with your own ASN.' });
      return;
    }

    // Link to a member org if the ASN belongs to one
    const targetOrg = await Organization.findOne({
      status: 'active',
      $or: [{ asn: targetAsn }, { additionalAsns: targetAsn }],
    });

    // Prevent duplicate pending request to the same ASN
    const existing = await PeeringRequest.findOne({ fromOrg: org._id, toAsn: targetAsn, status: 'pending' });
    if (existing) {
      res.status(409).json({ success: false, error: 'You already have a pending request to this network.' });
      return;
    }

    const reqDoc = await PeeringRequest.create({
      fromOrg: org._id,
      fromAsn: org.asn,
      toOrg: targetOrg?._id || null,
      toAsn: targetAsn,
      toName: targetOrg?.name || String(toName || `AS${targetAsn}`),
      message: String(message || '').trim(),
      locations: Array.isArray(locations) ? locations : [],
      createdBy: req.portalAuth!.email,
    });

    if (targetOrg) {
      await notify(String(targetOrg._id), {
        type: 'peering',
        title: 'New peering request',
        body: `AS${org.asn || '—'} (${org.name}) requested bilateral peering.`,
        link: 'peering',
      });
    }

    res.status(201).json({ success: true, data: { id: reqDoc._id, linkedToMember: !!targetOrg } });
  } catch (error) {
    console.error('Create peering request error:', error);
    res.status(500).json({ success: false, error: 'Failed to create request.' });
  }
};

/**
 * POST /api/portal/peering/requests/:id/respond   { action: 'accept'|'reject', responseMessage? }
 * Only the recipient org can respond.
 */
export const respondRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, responseMessage } = req.body as { action: string; responseMessage?: string };
    if (!['accept', 'reject'].includes(action)) {
      res.status(400).json({ success: false, error: 'Invalid action.' });
      return;
    }
    const reqDoc = await PeeringRequest.findOne({ _id: req.params.id, toOrg: req.organization!._id });
    if (!reqDoc) {
      res.status(404).json({ success: false, error: 'Request not found.' });
      return;
    }
    if (reqDoc.status !== 'pending') {
      res.status(400).json({ success: false, error: 'This request has already been handled.' });
      return;
    }
    reqDoc.status = action === 'accept' ? 'accepted' : 'rejected';
    reqDoc.responseMessage = String(responseMessage || '').trim();
    reqDoc.respondedAt = new Date();
    await reqDoc.save();
    await notify(String(reqDoc.fromOrg), {
      type: 'peering',
      title: `Peering request ${reqDoc.status}`,
      body: `AS${reqDoc.toAsn} ${reqDoc.status} your peering request.`,
      link: 'peering',
    });
    res.json({ success: true, data: { status: reqDoc.status } });
  } catch (error) {
    console.error('Respond peering request error:', error);
    res.status(500).json({ success: false, error: 'Failed to respond.' });
  }
};

/**
 * POST /api/portal/peering/requests/:id/cancel
 * Only the sender org can cancel a pending request.
 */
export const cancelRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const reqDoc = await PeeringRequest.findOne({ _id: req.params.id, fromOrg: req.organization!._id });
    if (!reqDoc) {
      res.status(404).json({ success: false, error: 'Request not found.' });
      return;
    }
    if (reqDoc.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Only pending requests can be cancelled.' });
      return;
    }
    reqDoc.status = 'cancelled';
    await reqDoc.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Cancel peering request error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel.' });
  }
};

/**
 * GET /api/portal/peering/marketplace
 * Other networks scored for peering fit (shared locations + open policy),
 * annotated with whether a request already exists.
 */
export const getMarketplace = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = req.organization!;
    const myLocations = new Set((org.locations || []).map((l) => l.toLowerCase()));

    const [orgs, requests] = await Promise.all([
      Organization.find({
        _id: { $ne: org._id },
        status: 'active',
        asn: { $ne: null, $exists: true },
      })
        .select('name asn type peeringPolicy locations website')
        .lean(),
      PeeringRequest.find({ fromOrg: org._id }).select('toAsn status').lean(),
    ]);

    const reqByAsn = new Map(requests.map((r: any) => [Number(r.toAsn), r.status]));

    const networks = orgs
      .map((o: any) => {
        const shared = (o.locations || []).filter((l: string) => myLocations.has(String(l).toLowerCase()));
        const score = shared.length * 2 + (o.peeringPolicy === 'Open' ? 1 : 0);
        return {
          id: o._id,
          name: o.name,
          asn: o.asn,
          type: o.type,
          peeringPolicy: o.peeringPolicy,
          locations: o.locations,
          website: o.website,
          sharedLocations: shared,
          recommended: o.peeringPolicy === 'Open' && shared.length > 0,
          requestStatus: reqByAsn.get(Number(o.asn)) || null,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({ success: true, data: networks });
  } catch (error) {
    console.error('Marketplace error:', error);
    res.status(500).json({ success: false, error: 'Failed to load marketplace.' });
  }
};

export default {
  getPolicy,
  updatePolicy,
  getNetworks,
  listRequests,
  createRequest,
  respondRequest,
  cancelRequest,
  getMarketplace,
};