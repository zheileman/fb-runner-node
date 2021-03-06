require('@ministryofjustice/module-alias/register-module')(module)

const getComponentController = require('~/fb-runner-node/controller/component/get-controller')

const {
  formatProperties
} = require('~/fb-runner-node/page/page')

async function submissionDataWithLabels (title, heading, subHeading, userData) {
  const answersComponent = {
    _id: 'page.summary.answers',
    _type: 'answers',
    onlyShowCompletedAnswers: false
  }

  const pageInstance = {
    _type: 'output.pdf',
    title: title,
    sectionHeading: subHeading,
    heading,
    columns: 'full',
    isPdf: true,
    components: [answersComponent]
  }

  await getComponentController(answersComponent)
    .preUpdateContents(answersComponent, userData, pageInstance)

  return formatProperties(pageInstance, userData)
}

module.exports = {
  submissionDataWithLabels
}
