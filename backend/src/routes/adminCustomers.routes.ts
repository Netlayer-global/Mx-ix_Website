import { Router } from 'express';
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
  createPort,
  updatePort,
  deletePort,
  createCustomerUser,
  deleteCustomerUser,
  impersonateCustomer,
} from '../controllers/adminCustomers.controller';
import { authMiddleware, adminRoleMiddleware } from '../middleware';

const router = Router();

// All routes require admin auth
router.use(authMiddleware);

router.get('/', listCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.post('/:id/status', setCustomerStatus);
router.post('/:id/impersonate', adminRoleMiddleware('support'), impersonateCustomer);
router.delete('/:id', deleteCustomer);

// Ports
router.post('/:id/ports', createPort);
router.put('/:id/ports/:portId', updatePort);
router.delete('/:id/ports/:portId', deletePort);

// Users
router.post('/:id/users', createCustomerUser);
router.delete('/:id/users/:userId', deleteCustomerUser);

export default router;
