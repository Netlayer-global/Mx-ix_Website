import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import peers from '../controllers/adminPeers.controller';

/**
 * Member connections and peers, including the end-to-end provisioning flow.
 * NOC-level access.
 */
const router = Router();

router.use(authMiddleware, adminRoleMiddleware('noc'));

// Provisioning
router.get('/options', peers.provisioningOptions);
router.get('/available-ports/:infrastructureId', peers.availablePorts);
router.post('/provision', peers.provisionConnection);

// MAC lookup across the whole fabric — before `/:id` so it isn't shadowed.
router.get('/macs/find', peers.findMac);

// Peers (VLAN interfaces)
router.get('/peers', peers.listPeers);
router.put('/peers/:id', peers.updatePeer);
router.post('/peers/:id/address', peers.reassignPeerAddress);
router.post('/peers/:vlanInterfaceId/move-vlan', peers.movePeerVlan);

// MAC addresses on a peer
router.get('/peers/:id/macs', peers.listMacs);
router.post('/peers/:id/macs', peers.addMac);
router.put('/peers/:id/macs/:macId', peers.updateMac);
router.delete('/peers/:id/macs/:macId', peers.deleteMac);

// Connections (virtual interfaces)
router.get('/connections', peers.listConnections);
router.put('/connections/:id', peers.updateConnection);
router.delete('/connections/:id', peers.deprovisionConnection);
router.get('/connections/:id/switch-config', peers.switchConfig);
router.post('/connections/:id/ports', peers.addConnectionPort);
router.put('/connections/:id/ports/:portId', peers.updateConnectionPort);
router.delete('/connections/:id/ports/:portId', peers.removeConnectionPort);

export default router;
