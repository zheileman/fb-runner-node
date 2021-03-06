const uuid = require('uuid')
const crypto = require('crypto')

const external = {}

external.createUserId = () => {
  return uuid.v4()
}

external.createUserToken = () => {
  return crypto.randomBytes(256).toString('hex')
}

external.createUserDigest = (userId, userToken, serviceSecret) => {
  const hash = crypto.createHmac('sha256', serviceSecret)
    .update(userId + userToken)
    .digest('hex')
  return hash
}

external.validateUserDigest = (userId, userToken, userDigest, serviceSecret) => {
  const digestCheck = external.createUserDigest(userId, userToken, serviceSecret)
  return digestCheck === userDigest
}

module.exports = external
