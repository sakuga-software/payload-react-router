'use server'

import type { ServerFunctionClientArgs } from 'payload'

import config from '@payload-config'
import { handleServerFunctions } from 'payload-react-router/server'

import { importMap } from './importMap.js'

/**
 * Payload's single server-function entry point (form state, document and list
 * rendering, locale copy…). The second argument is the revalidation opt-out
 * sent by the client wrapper; React Router reads it, Payload does not.
 */
export async function serverFunction(args: ServerFunctionClientArgs, _revalidation?: FormData) {
  return handleServerFunctions({ ...args, config, importMap })
}
