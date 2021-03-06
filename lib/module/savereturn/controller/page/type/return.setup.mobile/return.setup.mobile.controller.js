require('@ministryofjustice/module-alias/register-module')(module)

const CommonController = require('~/fb-runner-node/module/savereturn/controller/page/common')

const {
  client,
  sendSMS,
  getConfig
} = require('~/fb-runner-node/module/savereturn/controller/savereturn')

module.exports = class SetupMobileController extends CommonController {
  async postValidation (pageInstance, userData) {
    const userId = userData.getUserId()
    const userToken = userData.getUserToken()
    const email = userData.getUserDataProperty('email')
    const mobile = userData.getUserDataProperty('mobile')
    const duration = getConfig('smsCodeDuration')

    const code = await client.createSetupMobileCode(userId, userToken, email, mobile, duration, userData.logger)

    await sendSMS('sms.return.setup.mobile', userData, { code })

    return pageInstance
  }
}
