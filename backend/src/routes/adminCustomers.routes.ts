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
  searchZohoContacts,
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  listContactsByRole,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  setCustomerTags,
  listDocuments,
  createDocument,
  downloadDocument,
  updateDocument,
  deleteDocument,
} from '../controllers/adminCustomers.controller';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import { makeUploader } from '../services/fileStorage.service';
import { uploadErrorHandler } from '../middleware/upload.middleware';

const router = Router();

/** Customer documents are written to `uploads/customer-documents/<orgId>/`. */
const documentUpload = makeUploader('customer-documents', 'id');

// All routes require admin auth
router.use(authMiddleware);

// Zoho contact lookup (must precede '/:id')
router.get('/zoho/contacts', searchZohoContacts);

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

// Contacts
router.get('/contacts/by-role', listContactsByRole);
router.get('/:id/contacts', listContacts);
router.post('/:id/contacts', createContact);
router.put('/:id/contacts/:contactId', updateContact);
router.delete('/:id/contacts/:contactId', deleteContact);

// Notes
router.get('/:id/notes', listNotes);
router.post('/:id/notes', createNote);
router.put('/:id/notes/:noteId', updateNote);
router.delete('/:id/notes/:noteId', deleteNote);

// Tags (global CRUD + per-customer assignment)
router.get('/tags', listTags);
router.post('/tags', createTag);
router.put('/tags/:tagId', updateTag);
router.delete('/tags/:tagId', deleteTag);
router.post('/:id/tags', setCustomerTags);

// Documents (multipart upload → real file on disk)
router.get('/:id/documents', listDocuments);
router.post('/:id/documents', documentUpload.single('file'), uploadErrorHandler, createDocument);
router.get('/:id/documents/:docId/download', downloadDocument);
router.put('/:id/documents/:docId', updateDocument);
router.delete('/:id/documents/:docId', deleteDocument);

export default router;
