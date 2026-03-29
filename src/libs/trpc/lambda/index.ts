/**
 * This is your entry point to setup the root configuration for tRPC on the server.
 * - `initTRPC` should only be used once per app.
 * - We export only the functionality that we use so we can enforce which base procedures should be used
 *
 * Learn how to create protected base procedures and other things below:
 * @link https://trpc.io/docs/v11/router
 * @link https://trpc.io/docs/v11/procedures
 */

import { openTelemetry } from '../middleware/openTelemetry';
import { userAuth } from '../middleware/userAuth';
import { trpc } from './init';
import { oidcAuth } from './middleware/oidcAuth';
import { requireWorkspaceRole, workspaceAuth } from './middleware/workspace';

/**
 * Create a router
 * @link https://trpc.io/docs/v11/router
 */
export const router = trpc.router;

/**
 * Create an unprotected procedure
 * @link https://trpc.io/docs/v11/procedures
 **/
const baseProcedure = trpc.procedure.use(openTelemetry);

export const publicProcedure = baseProcedure;

// procedure that asserts that the user is logged in
export const authedProcedure = baseProcedure.use(oidcAuth).use(userAuth);

// workspace-aware procedures (validates membership, injects workspaceId + role)
export const workspaceProcedure = authedProcedure.use(workspaceAuth);
export const workspaceAdminProcedure = workspaceProcedure.use(requireWorkspaceRole('admin'));
export const workspaceOwnerProcedure = workspaceProcedure.use(requireWorkspaceRole('owner'));

/**
 * Create a server-side caller
 * @link https://trpc.io/docs/v11/server/server-side-calls
 */
export const createCallerFactory = trpc.createCallerFactory;
