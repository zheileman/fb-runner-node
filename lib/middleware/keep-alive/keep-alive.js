require('@ministryofjustice/module-alias/register-module')(module)

const express = require('express')
const router = express.Router()
const cookieParser = require('cookie-parser')

const { getInstanceProperty } = require('~/fb-runner-node/service-data/service-data')

const { getSessionOptions } = require('~/fb-runner-node/middleware/user-session/user-session')

function init (options = {}) {
  const sessionDuration = getInstanceProperty('service', 'sessionDuration')
  const {
    sessionName,
    secure,
    cookiePath,
    cookieMaxAge
  } = getSessionOptions(options, sessionDuration)

  return router
    .use(cookieParser())
    .use(({ cookies = {} }, res, next) => {
      /*
       *  If the ecnrypted session id is present then
       *  re-set the cookie to keep the session alive
       */
      if (Reflect.has(cookies, sessionName)) {
        res.cookie(sessionName, Reflect.get(cookies, sessionName), {
          httpOnly: true,
          secure,
          cookiePath,
          maxAge: 60 * 1000 * cookieMaxAge
        })
      }

      /*
       *  This request is always okay. (It doesn't tell
       *  us anything about the session and no user data is touched
       *  -- it also doesn't redirect arbitrarily)
       */
      res.status(200)
      res.json({
        status: 'OK',
        content: {
          statusCode: 200
        }
      })
    })
}

module.exports = {
  init
}
