import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * The Local API: the website reads content in the same process as the admin,
 * with no HTTP hop and no API token.
 */
export const getPayloadClient = () => getPayload({ config })

/**
 * Reads the request's Payload session. A signed-in user sees drafts, which is
 * what the live preview iframe in the admin loads. Anonymous visitors get
 * published documents only, through collection access control.
 */
export async function getReader(request: Request) {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: request.headers })
  return {
    draft: Boolean(user),
    payload,
    serverURL: new URL(request.url).origin,
    user,
  }
}
