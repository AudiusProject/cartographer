const fs = require('fs')
const yaml = require('js-yaml')

const { fetchTracks, fetchCollections, fetchUsers } = require('./lib/queries')
const {
  getLatestSiteMapNumber,
  createRootSiteIndex,
  createOrAppendSiteMap,
  createOrAppendSiteIndex
} = require('./lib/sitemap')

const argv = require('minimist')(process.argv.slice(2))
console.log('Invoked with args: ', argv)

const ROOT = './sitemaps'
const INDEX = './sitemaps/index.xml'
const TRACKS_INDEX = './sitemaps/tracks/index.xml'
const COLLECTIONS_INDEX = './sitemaps/collections/index.xml'
const USERS_INDEX = './sitemaps/users/index.xml'

const TRACKS_SITE_MAP_ROOT = './sitemaps/tracks'
const COLLECTIONS_SITE_MAP_ROOT = './sitemaps/collections'
const USERS_SITE_MAP_ROOT = './sitemaps/users'

const LATEST = './sitemaps/latest.yml'

const makeDirs = () => {
  if (!fs.existsSync(ROOT)) {
    fs.mkdirSync(ROOT)
  }
  if (!fs.existsSync(TRACKS_SITE_MAP_ROOT)) {
    fs.mkdirSync(TRACKS_SITE_MAP_ROOT)
  }
  if (!fs.existsSync(COLLECTIONS_SITE_MAP_ROOT)) {
    fs.mkdirSync(COLLECTIONS_SITE_MAP_ROOT)
  }
  if (!fs.existsSync(USERS_SITE_MAP_ROOT)) {
    fs.mkdirSync(USERS_SITE_MAP_ROOT)
  }
}

// Read stateful config to help us know where to index from
const readLatest = () => {
  let ret
  try {
    const { latest } = yaml.safeLoad(
      fs.readFileSync(LATEST, 'utf8')
    )
    ret = {
      latestTrack: latest.track,
      latestCollection: latest.collection,
      latestUser: latest.user
    }
  } catch (e) {
    ret = {
      latestTrack: 0,
      latestCollection: 0,
      latestUser: 0
    }
  }
  console.log('\nLatest: ', ret, '\n')
  return ret
}

// Updates the stateful config
const updateLatest = (latestTrack, latestCollection, latestUser) => {
  const obj = {
    latest: {
      track: latestTrack,
      collection: latestCollection,
      user: latestUser
    }
  }
  console.log('\nUpdated Latest: ', obj.latest, '\n')
  const y = yaml.safeDump(obj)
  fs.writeFileSync(LATEST, y)
}

/**
 * Indexes audius and creates/appends to sitemaps in the ./sitemaps folder.
 * This script is intended to be run as a cron-job and keep state of what it
 * has already indexed.
 */
const run = async () => {
  try {
    makeDirs()

    // Create a master site index if needed
    createRootSiteIndex(INDEX, TRACKS_INDEX, COLLECTIONS_INDEX, USERS_INDEX)

    // Read from the latest.yml config to determine where to start indexing
    const { latestTrack, latestCollection, latestUser } = readLatest()

    // Fetch tracks, collections, and users for processing
    const [fetchedTracks, fetchedCollections, fetchedUsers] = await Promise.all([
      fetchTracks(latestTrack, argv.count),
      fetchCollections(latestCollection, argv.count),
      fetchUsers(latestUser, argv.count)
    ])
    const { items: tracks, latest: newLatestTrack } = fetchedTracks
    const { items: collections, latest: newLatestCollection } = fetchedCollections
    const { items: users, latest: newLatestUser } = fetchedUsers

    console.log('\n')
    console.log(`Tracks: Fetched ${newLatestTrack - latestTrack} new`)
    console.log(`Collections: Fetched ${newLatestCollection - latestCollection} new`)
    console.log(`Users: Fetched ${newLatestUser - latestUser} new`)
    console.log('\n')

    // Create or append to sitemaps (potentially generating new ones because
    // the maximum size of a sitemap is 50K entrires)
    const latestTrackNumber = await createOrAppendSiteMap(
      tracks,
      getLatestSiteMapNumber(latestTrack),
      TRACKS_SITE_MAP_ROOT
    )
    const latestCollectionNumber = await createOrAppendSiteMap(
      collections,
      getLatestSiteMapNumber(latestCollection),
      COLLECTIONS_SITE_MAP_ROOT
    )
    const latestUserNumber = await createOrAppendSiteMap(
      users,
      getLatestSiteMapNumber(latestUser),
      USERS_SITE_MAP_ROOT
    )

    // Create or append to sub-indexes
    // Note: These may need to be root indexes for most crawlers as
    // nesting isn't always supported
    await createOrAppendSiteIndex(
      TRACKS_INDEX,
      TRACKS_SITE_MAP_ROOT,
      getLatestSiteMapNumber(latestTrack),
      latestTrackNumber
    )
    await createOrAppendSiteIndex(
      COLLECTIONS_INDEX,
      COLLECTIONS_SITE_MAP_ROOT,
      getLatestSiteMapNumber(latestCollection),
      latestCollectionNumber
    )
    await createOrAppendSiteIndex(
      USERS_INDEX,
      USERS_SITE_MAP_ROOT,
      getLatestSiteMapNumber(latestUser),
      latestUserNumber
    )

    // Update the latest.yml file that keeps track of what we've indexed
    updateLatest(newLatestTrack, newLatestCollection, newLatestUser)
  } catch (e) {
    console.error('Some error occured, output may be corrupted')
    console.error(e)
  }
}

run()
