import { Router } from 'express';
import { authMiddleware, adminRoleMiddleware } from '../middleware';
import tokens from '../controllers/adminApiTokens.controller';

/** API token management. Any admin can manage their own; super-admin can see/revoke all. */
const router = Router();

router.use(authMiddleware);

// Own tokens
router.get('/', tokens.listTokens);
router.post('/', tokens.createToken);
router.delete('/:id', tokens.revokeToken);

// Super-admin: audit all tokens
router.get('/all', adminRoleMiddleware('super-admin'), tokens.listAllTokens);
router.delete('/force/:id', adminRoleMiddleware('super-admin'), tokens.forceRevoke);

export default router;
