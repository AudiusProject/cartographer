const { create } = require('xmlbuilder2')
const yaml = require('js-yaml')
const fs = require('fs')

const MAX_SITE_MAP_ENTRIES = 50000

const VERSION = { version: '1.0' }
const XMLNS = 'http://www.sitemaps.org/schemas/sitemap/0.9'

const ROOT_AUDIUS_URL = process.env.ROOT_AUDIUS_URL

// Gets the right sitemap file name for a given item id
// Sitemaps can contain max of 50,000 items.
// e.g.
// - the 1st track goes on site map 1
// - the 50,0001st track goes on site map 2
const getLatestSiteMapNumber = (latest) => {
  return Math.ceil(((latest + 1) / MAX_SITE_MAP_ENTRIES) % MAX_SITE_MAP_ENTRIES)
}

// Gets the path for a sitemap given its number
const getSiteMapPath = (root, number) => {
  return `${root}/${number}.xml`
}

// Converts a relative path into an audius-specific path
const convertToAudiusURL = (path) => {
  return path.replace('./', `${ROOT_AUDIUS_URL}/`)
}

/* --------------------- SKELETONS --------------------- */
/* Creates default XML objects for various sitemap types */
const createMapSkeleton = () => {
  const xml = create(VERSION)
  const urlset = xml.ele('urlset')
  urlset.att('xmlns', XMLNS)
  return xml
}

const createIndexSkeleton = () => {
  const xml = create(VERSION)
  const sitemapindex = xml.ele('sitemapindex')
  sitemapindex.att('xmlns', XMLNS)
  return xml
}

const createRootIndexSkeleton = (tracksIndex, collectionsIndex, usersIndex, defaults) => {
  const xml = create(VERSION)
  const sitemapindex = xml.ele('sitemapindex')
  sitemapindex.att('xmlns', XMLNS)

  const defaultsMap = sitemapindex.ele('sitemap')
  defaultsMap.ele('loc').txt(convertToAudiusURL(defaults))

  const tracks = sitemapindex.ele('sitemap')
  tracks.ele('loc').txt(convertToAudiusURL(tracksIndex))

  const collections = sitemapindex.ele('sitemap')
  collections.ele('loc').txt(convertToAudiusURL(collectionsIndex))

  const users = sitemapindex.ele('sitemap')
  users.ele('loc').txt(convertToAudiusURL(usersIndex))
  return xml
}

/* --------------------- XML File Manipulation --------------------- */
/* Creates default XML objects for various sitemap types */

// Helper function to create an xml object at `path` using a provided
// skeleton method.
// If the file already exists, it's parsed into a js object and returned.
const createOrReadXMLAsObject = async (path, createSkeleton) => {
  let xml
  try {
    if (!path) throw new Error()
    const file = await new Promise((resolve, reject) => {
      fs.readFile(path, 'utf8', (err, contents) => {
        if (err) {
          reject(err)
        } else {
          resolve(contents)
        }
      })
    })
    if (!file) throw new Error()

    xml = create(file)
  } catch (e) {
    xml = createSkeleton()
  }

  const object = xml.end({ format: 'object' })
  return object
}

/**
 * Creates the root site index.
 * @param {string} path
 * @param {string} tracksIndex path of the tracks siteindex
 * @param {string} collectionsIndex path of the collections siteindex
 * @param {string} usersIndex path of the users siteindex
 */
const createRootSiteIndex = async (path, tracksIndex, collectionsIndex, usersIndex, defaults) => {
  const index = await createOrReadXMLAsObject(
    path,
    () => createRootIndexSkeleton(tracksIndex, collectionsIndex, usersIndex, defaults)
  )

  const xml = create(index).end({ prettyPrint: true })
  fs.writeFile(path, xml, () => {})
}

/**
 * Creates or appends to a sitemap (potentially generating new ones if the
 * most recently touched sitemap has > 50K entries).
 *
 * e.g.
 *  createOrAppendSiteMap(
 *    ['url1', 'url2'],
 *    2,
 *    ./sitemaps/tracks/
 *  )
 *  will append <loc>url1</loc>, <loc>url2</loc> to ./sitemaps/tracks/2.xml
 *  or ./sitemaps/tracks/3.xml if 2 is full.
 *
 * @param {Array<string>} urls <loc> for sitemap entries
 * @param {number} latestSiteMapNumber the latest numbered sitemap, e.g. 3.xml
 * @param {string} siteMapRoot path to store this sitemap
 */
const createOrAppendSiteMap = async (urls, latestSiteMapNumber, siteMapRoot) => {
  const latestMapPath = getSiteMapPath(siteMapRoot, latestSiteMapNumber)
  const existingSiteMap = await createOrReadXMLAsObject(latestMapPath, createMapSkeleton)

  let siteMapNumber = latestSiteMapNumber

  const maps = [existingSiteMap]
  const paths = [latestMapPath]
  for (let i = 0; i < urls.length; ++i) {
    const url = urls[i]
    const map = maps[maps.length - 1]

    if (map.urlset.url) {
      if (map.urlset.url.length > MAX_SITE_MAP_ENTRIES - 1) {
        // Make a new site map with the correctly named index (latest + 1)
        siteMapNumber += 1
        const path = getSiteMapPath(
          siteMapRoot,
          siteMapNumber
        )
        const newMap = await createOrReadXMLAsObject(null, createMapSkeleton)
        newMap.urlset.url = [{ loc: url }]
        // Append to the existing maps & paths to write out at the end
        paths.push(path)
        maps.push(newMap)
      } else {
        // Edge-case:
        // if there's only one entry, the xml isn't parsed as a list
        if (!map.urlset.url.length) {
          map.urlset.url = [
            { loc: map.urlset.url.loc },
            { loc: url }
          ]
        } else {
          // Some urls exist, append to them
          map.urlset.url.push({
            loc: url
          })
        }
      }
    } else {
      map.urlset.url = [{ loc: url }]
    }
  }

  maps.forEach((map, i) => {
    const path = paths[i]
    const xml = create(map).end({ prettyPrint: true })
    fs.writeFile(path, xml, () => {})
  })

  return siteMapNumber
}

/**
 * Creates or appends to an existing sitemap index by indexing
 * all of the sitemaps in a directory.
 *
 * e.g.
 *  createOrAppendSiteIndex(
 *    './sitemaps/tracks/index.xml',
 *    './sitemaps/tracks/',
 *    2,
 *    4
 *  )
 * Will update './sitemaps/tracks/index.xml' so that it contains <loc>
 * entries for 2.xml, 3.xml, and 4.xml in ./sitemaps/tracks
 *
 * @param {string} path path to write the index to
 * @param {string} siteMapRoot the root directory to index all the files of
 * @param {number} latestNumber the last latest numbered xml file
 * @param {number} newNumber the new latest numbered xml file
 */
const createOrAppendSiteIndex = async (path, siteMapRoot, latestNumber, newNumber) => {
  const siteIndex = await createOrReadXMLAsObject(path, createIndexSkeleton)

  // Create the first entry in the index if it doesn't exist
  if (!siteIndex.sitemapindex.sitemap) {
    const loc = getSiteMapPath(siteMapRoot, latestNumber)
    siteIndex.sitemapindex.sitemap = [{ loc: convertToAudiusURL(loc) }]
  }

  // Create new entries in the index if needed based on how many
  // sitemap files were generated.
  let i = latestNumber + 1
  for (i; i <= newNumber; ++i) {
    console.log(latestNumber, newNumber)
    const newLoc = getSiteMapPath(siteMapRoot, i)
    if (siteIndex.sitemapindex.sitemap) {
      // Edge-case:
      // if there's only one entry, the xml isn't parsed as a list
      if (!siteIndex.sitemapindex.sitemap.length) {
        siteIndex.sitemapindex.sitemap = [
          { loc: siteIndex.sitemapindex.sitemap.loc },
          { loc: convertToAudiusURL(newLoc) }
        ]
      } else {
        siteIndex.sitemapindex.sitemap.push({
          loc: convertToAudiusURL(newLoc)
        })
      }
    } else {
      siteIndex.sitemapindex.sitemap = [{ loc: convertToAudiusURL(newLoc) }]
    }
  }

  const xml = create(siteIndex).end({ prettyPrint: true })
  fs.writeFile(path, xml, () => {})
}

/**
 * Creates defaults.xml, a sitemap for static routes, e.g. /feed
 * @param {string} path
 * @param {string} config file location for the defaults.yml config
 */
const createSiteDefaults = async (path, config) => {
  const defaults = yaml.safeLoad(
    fs.readFileSync(config)
  )

  const map = await createOrReadXMLAsObject(null, createMapSkeleton)
  map.urlset.url = defaults.routes.map(route => ({ loc: `${ROOT_AUDIUS_URL}${route}` }))

  const xml = create(map).end({ prettyPrint: true })
  fs.writeFile(path, xml, () => {})
}

module.exports = {
  getLatestSiteMapNumber,
  createRootSiteIndex,
  createOrAppendSiteIndex,
  createOrAppendSiteMap,
  createSiteDefaults
}
