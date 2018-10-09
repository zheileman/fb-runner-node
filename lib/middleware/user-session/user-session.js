const express = require('express')
const router = express.Router()
const cookieParser = require('cookie-parser')

const aes256 = require('aes256')

const user = require('../../user/user')

const fakeSession = {}

const external = {}

external.init = (options = {}) => {
  // set secure: true when proper environments
  const actualOptions = Object.assign({}, {
    sessionName: 'sessionId',
    secure: false,
    cookiePath: '/',
    cookieMaxAge: 30 // minutes
  }, options)

  const {
    sessionName,
    secure,
    cookiePath,
    cookieMaxAge
  } = actualOptions

  let {serviceToken} = actualOptions
  serviceToken = serviceToken || '<NONE>'

  const genid = (userId, userToken) => {
    userId = userId || user.createUserId()
    userToken = userToken || user.createUserToken()
    const userDigest = user.createUserDigest(userId, userToken, serviceToken)
    const userDigestBundle = {
      userId,
      userToken,
      userDigest
    }
    return JSON.stringify(userDigestBundle)
  }

  const setSessionCookie = (res, encryptedDigestBundle) => {
    res.cookie(sessionName, encryptedDigestBundle, {
      httpOnly: true,
      secure,
      cookiePath,
      maxAge: 60 * 1000 * cookieMaxAge
    })
  }

  const createSessionCookie = (res) => {
    const digestBundle = genid()
    const encryptedDigestBundle = aes256.encrypt(serviceToken, digestBundle)
    setSessionCookie(res, encryptedDigestBundle)
    return encryptedDigestBundle
  }

  router.use(cookieParser())
  router.use((req, res, next) => {
    let encrypedSessionId = req.cookies[sessionName]
    if (!encrypedSessionId) {
      //  Brand new session
      req.newSession = true
      encrypedSessionId = createSessionCookie(res)
    } else {
      // keep cookie rolling
      setSessionCookie(res, encrypedSessionId)
    }
    const sessionId = aes256.decrypt(serviceToken, encrypedSessionId)

    let userValues = {}
    try {
      if (sessionId) {
        userValues = JSON.parse(sessionId)
      }
    } catch (e) {
      // cookie was invalid
      createSessionCookie(res)
      return res.redirect('/')
      // throw new Error(400)
    }

    const {userId, userToken, userDigest} = userValues
    const isValidUser = user.validateUserDigest(userId, userToken, userDigest, serviceToken)
    if (!isValidUser) {
      // console.log('not a valid user')
      createSessionCookie(res)
      return res.redirect('/')
      // throw new Error(400)
    }

    // TODO move loading of data here out of user-data and pass saveData in

    if (!fakeSession[encrypedSessionId]) {
      fakeSession[encrypedSessionId] = {
        userId,
        userToken
      }
    }
    req.session = fakeSession[encrypedSessionId]

    next()
  })
  return router
}

module.exports = external