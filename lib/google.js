const { google } = require('googleapis')

const MAPS = [
  'https://audius.co/sitemaps/tracks/index.xml',
  'https://audius.co/sitemaps/collections/index.xml',
  'https://audius.co/sitemaps/users/index.xml'
]

const SITE_URL = 'https://audius.co/'

const scopes = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/indexing'
]

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// })

/**
 * Submits a new (or updates an existing) sitemap to the search console
 * @param {object} webmasters Google webmasters api
 */
const submit = async (webmasters, url) => {
  const res = await new Promise(resolve => {
    webmasters.sitemaps.submit(
      {
        siteUrl: SITE_URL,
        feedPath: url
      },
      resolve
    )
  })
  return res
}

/**
 * Updates the audius sitemaps in the search console
 */
const updateSitemaps = async () => {
  const auth = new google.auth.GoogleAuth({
    scopes
  })
  const authClient = await auth.getClient()
  const webmasters = google.webmasters({
    version: 'v3',
    auth: authClient
  })

  // List sitemaps
  const l = await new Promise(resolve => {
    webmasters.sitemaps.list(
      {
        siteUrl: 'audius.co'
      },
      resolve
    )
  })
  if (l.response.data.error) {
    throw new Error(JSON.stringify(l.response.data.error.errors.map(e => e.message)))
  }

  // Submit sitemaps
  // TODO: Uncomment
  // MAPS.forEach(async map => {
  //   const res = await submit(webmasters, map)
  //   console.log(res)
  // })
}

const run = async () => {
  try {
    await updateSitemaps()
    console.log('done!')
  } catch (e) {
    console.error('Oh no! Something went wrong :-(')
    console.error(e)
  }
}

run()
