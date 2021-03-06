require('@ministryofjustice/module-alias/register-module')(module)

const cloneDeep = require('lodash.clonedeep')

const CommonController = require('~/fb-runner-node/module/savereturn/controller/page/common')

const {
  client,
  handleValidationError,
  resetUser,
  authenticate,
  sendEmail
} = require('~/fb-runner-node/module/savereturn/controller/savereturn')

module.exports = class SigninMobileValidateController extends CommonController {
  async preUpdateContents (pageInstance, userData) {
    const email = userData.getUserDataProperty('email')
    const mobile = userData.getUserDataProperty('mobile')
    if (!email || !mobile) {
      pageInstance.redirect = 'return.start'
    }
    return pageInstance
  }

  async postValidation (instance, userData) {
    const code = userData.getUserDataProperty('signin_code')
    if (!code) {
      return instance
    }
    const pageInstance = cloneDeep(instance)
    userData.unsetUserDataProperty('signin_code')
    const email = userData.getUserDataProperty('email')
    try {
      const details = await client.validateSigninMobileCode(code, email, userData.logger)

      await resetUser(userData, details)
      authenticate(userData, 'signin-code')
      await sendEmail('email.return.signin.success', userData)

      pageInstance.redirect = 'return.authenticated'
    } catch (e) {
      if (e.message && e.message === 'code.invalid') {
        return pageInstance
      }
      return handleValidationError(e, 'return.signin.mobile')
    }
    return pageInstance
  }
}
