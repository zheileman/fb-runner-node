require('@ministryofjustice/module-alias/register-module')(module)

const {
  test
} = require('tape')

const submitterClient = require('~/fb-runner-node/client/submitter/submitter')

const sinon = require('sinon')

const { getUserDataMethods } = require('~/fb-runner-node/middleware/user-data/user-data')

const proxyquire = require('proxyquire')

const serviceData = require('~/fb-runner-node/service-data/service-data')
const getInstancePropertyStub = sinon.stub(serviceData, 'getInstanceProperty')
const getInstanceStub = sinon.stub(serviceData, 'getInstance')

const route = require('~/fb-runner-node/route/route')
const getUrlStub = sinon.stub(route, 'getUrl')
const getNextPageStub = sinon.stub(route, 'getNextPage')

const getRedirectForNextPageStub = sinon.stub()

const submitterClientSpy = sinon.spy(submitterClient, 'submit')

const checkSubmitsStub = (_instanceData, _userData) => true

const pdfPayload = { some: 'PDF contents' }
const pdfPayloadStub = (_rawFormData) => pdfPayload
const submissionDataWithLabelsStub = sinon.stub()

const PageSummaryController = proxyquire('.', {
  '~/fb-runner-node/route/route': route,
  '~/fb-runner-node/service-data/service-data': serviceData,
  '~/fb-runner-node/page/redirect-next-page/redirect-next-page': getRedirectForNextPageStub,
  '~/fb-runner-node/client/submitter/submitter': { submitterClient: submitterClientSpy },
  '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
  '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub }
})

getInstancePropertyStub.callsFake((_id, type) => {
  const matches = {
    isConfirmation: 'page.confirmation',
    fauxConfirmation: 'page.content'
  }

  return type === '_type' ? matches[_id] : undefined
})

getInstanceStub.callsFake(_id => {
  const matches = {
    'page.start': {
      _id: 'page.start'
    }
  }
  return matches[_id]
})

getUrlStub.callsFake(_id => {
  const matches = {
    isSubmit: '/isSubmit',
    notAnswered: '/notAnswered'
  }
  return matches[_id]
})

getNextPageStub.callsFake(args => {
  const matches = {
    isSubmit: 'isConfirmation',
    fauxSubmit: 'fauxConfirmation'
  }
  return {
    _id: matches[args._id]
  }
})

const userData = {
  getUserDataProperty: () => {},
  setUserDataProperty: () => {},
  getUserParams: () => ({}),
  getUserId: () => 'userId',
  getUserToken: () => 'userToken',
  getOutputData: () => ({
    mock_question_1: 'mock_answer_1'
  }),
  uploadedFiles: () => {
    return []
  }
}

const userDataWithFiles = {
  getUserDataProperty: () => {},
  setUserDataProperty: () => {},
  getUserParams: () => ({}),
  getUserId: () => 'userId',
  getUserToken: () => 'userToken',
  getOutputData: () => ({}),
  uploadedFiles: () => {
    return [{
      url: 'SUBMITTER_URL/service/SERVICE_SLUG/user/36c1af3e-a213-4293-8a82-f26ae7a23215/1568971532923',
      mimetype: 'image/png',
      filename: 'image.png',
      type: 'filestore'
    }]
  }
}

test('When there is no next page', async t => {
  const pageInstance = { _id: 'noSubmit' }

  const pageSummaryController = new PageSummaryController()

  const expectedInstance = await pageSummaryController.preFlight(pageInstance, userData)
  t.equals(expectedInstance.redirect, undefined, 'it should not return an unanswered page to redirect to')
  t.end()
})

test('When the next page is not a confirmation page', async t => {
  const pageInstance = { _id: 'fauxSubmit' }

  const pageSummaryController = new PageSummaryController()

  const expectedInstance = await pageSummaryController.preFlight(pageInstance, userData)
  t.equals(expectedInstance.redirect, undefined, 'it should not return an unanswered page to redirect to')
  t.end()
})

test('When all previous required questions have been answered', async t => {
  const pageInstance = { _id: 'isSubmit' }
  getRedirectForNextPageStub.reset()
  getRedirectForNextPageStub.callsFake(async (pageInstance) => pageInstance)

  const pageSummaryController = new PageSummaryController()

  const expectedInstance = await pageSummaryController.preFlight(pageInstance, userData)
  t.equals(expectedInstance.redirect, undefined, 'it should not return an unanswered page to redirect to')
  t.end()
})

test('When any previous required questions have not been answered', async t => {
  const pageInstance = { _id: 'isSubmit' }
  getRedirectForNextPageStub.reset()
  getRedirectForNextPageStub.returns({ redirect: 'notAnswered' })

  const pageSummaryController = new PageSummaryController()

  const expectedInstance = await pageSummaryController.preFlight(pageInstance, userData)
  t.equals(expectedInstance.redirect, '/notAnswered', 'it should return the url of an unanswered page to redirect to')
  t.end()
})

test('When all previous required questions have been answered', async t => {
  const pageInstance = { _id: 'isSubmit' }
  getRedirectForNextPageStub.reset()
  getRedirectForNextPageStub.returns({ redirect: 'isSubmit' })

  const pageSummaryController = new PageSummaryController()

  const expectedInstance = await pageSummaryController.preFlight(pageInstance, userData)
  t.equals(expectedInstance.redirect, undefined, 'it should not return an unanswered page to redirect to')
  t.end()
})

test('When all previous required questions have been answered - and a url is returned', async t => {
  const pageInstance = { _id: 'isSubmit' }
  getRedirectForNextPageStub.reset()
  getRedirectForNextPageStub.returns({ redirect: '/isSubmit' })

  const pageSummaryController = new PageSummaryController()

  const expectedInstance = await pageSummaryController.preFlight(pageInstance, userData)
  t.equals(expectedInstance.redirect, undefined, 'it should not return an unanswered page to redirect to')
  t.end()
})

test('it attaches a user submission when the property is set to true', async t => {
  getInstancePropertyStub.withArgs('service', 'attachUserSubmission').returns(true)

  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  const userdataUserEmail = getUserDataMethods({
    input: {
      email: '\'user@example.com\''
    }
  })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdataUserEmail)

  const submissions = submitterClientSpy.getCall(0).args[0].actions

  t.equals(submissions[1].recipientType, 'user')
  t.equals(submissions[1].attachments.length, 1)
  submitterClientSpy.resetHistory()
  t.end()
})

test('it attaches metadata to submission', async t => {
  getInstancePropertyStub.withArgs('service', 'attachUserSubmission').returns(true)

  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  const userdataUserEmail = getUserDataMethods({
    input: {
      email: '\'user@example.com\''
    }
  })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdataUserEmail)

  const submission = submitterClientSpy.getCall(0).args[0]

  t.ok(submission.meta.submission_id.match(/[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/))
  t.ok(submission.meta.submission_at.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/))
  submitterClientSpy.resetHistory()
  t.end()
})

test('it does not attach a user submission when the property is set to false', async t => {
  getInstancePropertyStub.withArgs('service', 'attachUserSubmission').returns(false)

  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  const userdata = getUserDataMethods({ input: { email: 'test@emample.com' } })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)

  const actions = submitterClientSpy.getCall(0).args[0].actions

  t.equals(actions[1].recipientType, 'user')
  t.equals(actions[1].attachments.length, 0)
  submitterClientSpy.resetHistory()
  t.end()
})

test('it attaches json to submission when env var present', async t => {
  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_JSON_ENDPOINT: 'https://example.com/adaptor',
      SERVICE_OUTPUT_JSON_KEY: 'shared_key',
      RUNNER_URL: 'http://service-slug.formbuilder-services-test-dev:3000',
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  const userData = getUserDataMethods({ input: { mock_question_1: 'mock_answer_1' } })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userData)

  const submissions = submitterClientSpy.getCall(0).args[0].actions
  t.equals(submissions[1].type, 'json')
  t.equals(submissions[1].url, 'https://example.com/adaptor')
  t.equals(submissions[1].encryption_key, 'shared_key')
  t.equals(submissions[1].user_answers.mock_question_1, 'mock_answer_1')

  t.deepEquals(submissions[1].attachments, [])
  submitterClientSpy.resetHistory()
  t.end()
})

test('when there are files it attaches them to json submission', async t => {
  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_JSON_ENDPOINT: 'https://example.com/adaptor',
      SERVICE_OUTPUT_JSON_KEY: 'shared_key',
      RUNNER_URL: 'http://service-slug.formbuilder-services-test-dev:3000',
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  const userdata = getUserDataMethods({ input: { firstname: 'bob' } })
  userdata.uploadedFiles = () => {
    return [{
      url: 'SUBMITTER_URL/service/SERVICE_SLUG/user/36c1af3e-a213-4293-8a82-f26ae7a23215/1568971532923',
      mimetype: 'image/png',
      filename: 'image.png',
      type: 'filestore'
    }]
  }

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)

  const submissions = submitterClientSpy.getCall(0).args[0].actions
  t.equals(submissions[1].type, 'json')
  t.equals(submissions[1].url, 'https://example.com/adaptor')
  t.equals(submissions[1].encryption_key, 'shared_key')
  t.deepEquals(submissions[1].attachments, userDataWithFiles.uploadedFiles())
  submitterClientSpy.resetHistory()
  t.end()
})

test('when there are files it attaches to the root key attachments', async t => {
  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub }
  })

  const attachments = [
    {
      url: 'SUBMITTER_URL/service/SERVICE_SLUG/user/36c1af3e-a213-4293-8a82-f26ae7a23215/1568971532923',
      mimetype: 'image/png',
      filename: 'image_1.png',
      type: 'filestore'
    }, {
      url: 'SUBMITTER_URL/service/SERVICE_SLUG/user/36c1af3e-a213-4293-8a82-f26ae7a23215/1568971532924',
      mimetype: 'image/png',
      filename: 'image_2.png',
      type: 'filestore'
    }
  ]

  const userdata = getUserDataMethods({ input: { firstname: 'bob' } })
  userdata.uploadedFiles = () => {
    return attachments
  }

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)
  const submission = submitterClientSpy.getCall(0).args[0]

  t.deepEquals(submission.attachments, attachments)

  submitterClientSpy.resetHistory()
  t.end()
})

test('it does not attach json to submission when env var not present', async t => {
  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  const userdata = getUserDataMethods({ input: {} })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)

  const submissions = submitterClientSpy.getCall(0).args[0].actions
  const jsonEntries = submissions.filter(s => s.type === 'json')

  t.deepEquals(jsonEntries, [])
  submitterClientSpy.resetHistory()
  t.end()
})

test('Dynamic content is rendered in the Team email body', async t => {
  submitterClientSpy.resetHistory()

  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  getInstancePropertyStub.withArgs('service', 'emailTemplateTeam').returns('user {firstname} submitted!')

  const userdata = getUserDataMethods({ input: { firstname: 'bob' } })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)

  const submissions = submitterClientSpy.getCall(0).args[0].actions
  const emailEntries = submissions.filter(s => s.type === 'email')

  t.equals(emailEntries[0].recipientType, 'team')
  t.equals(emailEntries[0].email_body, 'user bob submitted!')

  submitterClientSpy.resetHistory()
  t.end()
})

test('user email body can be overridden to use a rendered template', async t => {
  submitterClientSpy.resetHistory()

  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk'
    }
  })

  getInstancePropertyStub.withArgs('service', 'emailTemplateUser').returns('you ({firstname}) submitted!')

  const userdata = getUserDataMethods({
    input: {
      firstname: 'bob',
      email: 'test@emample.com'
    }
  })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)

  const submissions = submitterClientSpy.getCall(0).args[0].actions
  const emailEntries = submissions.filter(s => s.type === 'email')

  t.equals(emailEntries[1].recipientType, 'user')
  t.equals(emailEntries[1].email_body, 'you (bob) submitted!')

  submitterClientSpy.resetHistory()
  t.end()
})

test('actions contains email and json actions', async t => {
  submitterClientSpy.resetHistory()

  const PageSummaryController = proxyquire('.', {
    '~/fb-runner-node/presenter/pdf-payload': { pdfPayload: pdfPayloadStub },
    '~/fb-runner-node/presenter/submission-data-with-labels': { submissionDataWithLabels: submissionDataWithLabelsStub },
    '~/fb-runner-node/page/check-submits/check-submits': { checkSubmits: checkSubmitsStub },
    '~/fb-runner-node/constants/constants': {
      SERVICE_OUTPUT_JSON_ENDPOINT: 'https://example.com/adaptor',
      SERVICE_OUTPUT_JSON_KEY: 'shared_key',
      SERVICE_OUTPUT_EMAIL: 'bob@gov.uk',
      SERVICE_OUTPUT_CSV: 'true'
    }
  })

  getInstancePropertyStub.withArgs('service', 'emailTemplateUser').returns('you ({firstname}) submitted!')

  const userdata = getUserDataMethods({
    input: {
      firstname: 'bob',
      email: 'test@emample.com'
    }
  })

  const pageSummaryController = new PageSummaryController()

  await pageSummaryController.postValidation({}, userdata)

  const submissions = submitterClientSpy.getCall(0).args[0]

  t.equals(submissions.actions.length, 4)

  // remove deprecated fields
  submissions.actions.map(action => {
    delete action.attachments
    delete action.user_answers
  })

  t.deepEquals(submissions.actions, [
    {
      recipientType: 'team',
      type: 'email',
      from: '"Form Builder" <form-builder-team@digital.justice.gov.uk>',
      subject: 'undefined submission',
      email_body: 'user bob submitted!',
      include_pdf: true,
      include_attachments: true,
      to: 'bob@gov.uk'
    }, {
      recipientType: 'user',
      type: 'email',
      from: '"Form Builder" <form-builder-team@digital.justice.gov.uk>',
      subject: 'Your undefined submission',
      email_body: 'you (bob) submitted!',
      include_pdf: false,
      include_attachments: false,
      to: 'test@emample.com'
    }, {
      type: 'json',
      url: 'https://example.com/adaptor',
      encryption_key: 'shared_key'
    }, {
      type: 'csv',
      recipientType: 'team',
      from: '"Form Builder" <form-builder-team@digital.justice.gov.uk>',
      to: 'bob@gov.uk',
      email_body: '',
      include_pdf: false,
      subject: 'undefined submission',
      include_attachments: true
    }
  ])

  submitterClientSpy.resetHistory()
  t.end()
})
