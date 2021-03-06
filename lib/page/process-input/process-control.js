require('@ministryofjustice/module-alias/register-module')(module)

const getComponentComposite = require('~/fb-runner-node/controller/component/common/get-composite')

const skipControlValidation = require('./skip-control-validation')
const skipControlProcessing = require('./skip-control-processing')
const processControlComposite = require('./process-control-composite')
const processControlStandard = require('./process-control-standard')
const updateControlValue = require('./update-control-value')
const updateControlDisplayValue = require('./update-control-display-value')

const processControl = (pageInstance, userData, nameInstance) => {
  skipControlValidation(pageInstance, userData, nameInstance)

  if (skipControlProcessing(pageInstance, userData, nameInstance)) {
    return
  }

  const composite = getComponentComposite(nameInstance)
  const controlName = nameInstance.$originalName || nameInstance.name

  const options = {
    controlName,
    composite
  }

  if (!nameInstance.$skipValidation) {
    const processControlType = composite ? processControlComposite : processControlStandard

    options.nameValue = processControlType(pageInstance, userData, nameInstance, Object.assign({}, options))
  }

  updateControlValue(pageInstance, userData, nameInstance, options)

  updateControlDisplayValue(pageInstance, userData, nameInstance, options)
}

module.exports = processControl
