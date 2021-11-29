const { NodeJsSSB } = require("./nodejs-ssb/ssb.js")
const { GoSSB } = require("./go-ssb/ssb.js")

const platforms = {
  "nodejs-ssb": NodeJsSSB,
  "go-ssb": GoSSB,
}

const setServerType = (serverType = "nodejs-ssb", keys, remote) => {
  if (platforms.hasOwnProperty(serverType)) {
    global.ssb = new platforms[serverType]()
  } else {
    throw `unknown server type: ${serverType}`
  }
}

global.setServerType = setServerType

module.exports = platforms
