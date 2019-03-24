const express = require('express')
const router = express.Router()
let CONSTANTS = require('../../constants/constants')
const {PORT} = CONSTANTS

const puppeteer = require('puppeteer')
const json2csv = require('json2csv').parse
const flatten = require('flat')

const {addCleanupTask} = require('../../server/server-cleanup')

const nunjucksConfiguration = require('../nunjucks-configuration/nunjucks-configuration')
const {getInstanceProperty} = require('../../service-data/service-data')
const {format} = require('../../format/format')

const controllers = require('../../page/controller/controller')
const summaryController = controllers['page.summary'] || {}

let browser

const initialisePuppeter = async () => {
// Someone set us up the browser - all your page are belong to us
  browser = await puppeteer.launch({args: ['--no-sandbox']})

  addCleanupTask(() => {
    browser.close()
  })
}

const generateOutput = async (req, res) => {
  if (!browser) {
    await initialisePuppeter()
  }
  const {outputType, outputId, filename} = req.params
  const userData = req.user

  const code = getInstanceProperty('service', 'code')
  const subHeading = getInstanceProperty('service', 'pdfSubHeading')
  const heading = getInstanceProperty('service', 'pdfHeading')
  const submissionId = userData.getUserDataProperty('submissionId')
  const submissionDate = userData.getUserDataProperty('submissionDate')
  let submission = code
  if (submissionId) {
    submission += ` / ${submissionId}`
  }
  if (submissionDate) {
    const formattedDate = (new Date(submissionDate)).toUTCString()
    submission += ` / ${formattedDate}`
  }

  if (outputType === 'pdf') {
    let pageInstance = {
      _type: 'output.pdf',
      title: submission,
      sectionHeading: subHeading,
      heading
    }
    if (summaryController.setContents) {
      pageInstance = summaryController.setContents(pageInstance, userData, res, true)
    }

    let output = await nunjucksConfiguration.renderPage(pageInstance, Object.assign({}, res.locals)) // getPageOutput()
    output = output.replace(/<head>/, `<head><base href="http://localhost:${PORT}">`)
    output = output.replace(/<title>.*<\/title>/, `<title>${submission}</title>`)
    // const context = await browser.createIncognitoBrowserContext()
    const page = await browser.newPage()

    await page.setContent(output)

    await page.emulateMedia('screen')
    const pdfOutput = await page.pdf({
      scale: 0.75,
      format: 'A4',
      printBackground: true,
      margin: {
        bottom: '1cm'
      },
      displayHeaderFooter: true,
      footerTemplate: `
<style>
html, body, div {
margin: 0 !important;
padding: 0 !important;
font-size: 10px;
}
.pdfFooter {
display: block;
border-top: solid 1px #bfc1c3;
margin: 0 0.5cm;
padding: 0.125cm 0;
-webkit-print-color-adjust: exact;
width: 100%;
box-sizing: border-content;
}
.pdfFooter * {
display: inline-block;
font-family: HelveticaNeue, Helvetica, Arial, sans-serif;
}
.submission {
float: left;
}
.pages {
float: right;
}
</style>
<span class="pdfFooter">
<span class="submission">${submission}</span>
<span class="pages"><span class="pageNumber">pageNumber</span>/<span class="totalPages">totalPages</span></span>
</span>`
    })
    await page.goto('about:blank')
    await page.close()

    // res.setHeader('Content-Length', pdfOutput.length);
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.write(pdfOutput)
    res.end()
  } else if (outputType === 'email') {
    let email
    if (outputId === 'team') {
      email = getInstanceProperty('service', 'emailTemplateTeam') || 'Please find an application attached'
    } else if (outputId === 'user') {
      email = getInstanceProperty('service', 'emailTemplateUser') || 'A copy of your application is attached'
    } else {
      email = 'A copy of the application is attached'
    }
    const formatEmail = (str, markdown = false) => {
      try {
        str = format(str, req.user.getUserData(), {markdown})
      } catch (e) {
        //
      }
      return str
    }
    email = formatEmail(email)
    res.send(email)
  } else if (outputType === 'json') {
    let jsonData = userData.getOutputData()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.send(JSON.stringify(jsonData, null, 2))
    // res.json(jsonData)
  } else if (outputType === 'csv') {
    let jsonData = flatten(userData.getOutputData())
    let outputData = {}
    Object.keys(jsonData).reverse().forEach(key => {
      let normalisedKey = key
      if (key.match(/\b\d+\b/)) {
        const adjustedKey = key.replace(/\b(\d+)\b/g, (m, m1) => {
          return 1 + Number(m1)
        })
        normalisedKey = adjustedKey
      }
      outputData[normalisedKey] = jsonData[key]
    })
    const fields = Object.keys(outputData).reverse()

    // let outputStr = fields.join(',')
    // outputStr += '\n'
    // const fieldValues = fields.map(field => {
    //   let value = outputData[field]
    //   if (typeof value === 'string') {
    //     value = `"${value}"`
    //   }
    //   if (value === undefined) {
    //     value = ''
    //   }
    //   return value
    // })
    // outputStr += fieldValues.join(',')
    // outputStr += '\n'
    const csvOutput = json2csv(outputData, {fields})
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`)
    res.write(csvOutput)
    res.end()
  } else {
    throw new Error(404)
  }
}

// Convenience route to generate output for current user
router.use('/:outputType/:outputId/:filename?', async (req, res) => {
  await generateOutput(req, res)
})

const routesOutput = (options = {}) => {
  return router
}

module.exports = {
  init: routesOutput
}