let is = require('type-is')
let Busboy = require('busboy')
let extend = require('xtend')
let onFinished = require('on-finished')
let appendField = require('append-field')

let Counter = require('multer/lib/counter')
let MulterError = require('multer/lib/multer-error')
let FileAppender = require('multer/lib/file-appender')
let removeUploadedFiles = require('multer/lib/remove-uploaded-files')

function drainStream (stream) {
  stream.on('readable', stream.read.bind(stream))
}

function makeMiddleware (setup) {
  return function multerMiddleware (req, res, next) {
    if (!is(req, ['multipart'])) return next()

    let options = setup()

    let limits = options.limits
    let storage = options.storage
    let fileFilter = options.fileFilter
    let fileStrategy = options.fileStrategy
    let preservePath = options.preservePath

    req.body = Object.create(null)
    req.bodyErrors = Object.create(null)
    const addFilesError = (fieldname, err, originalname) => {
      req.bodyErrors.files = req.bodyErrors.files || Object.create(null)
      const code = typeof err === 'string' ? err : err.code || 'UNKNOWN_ERROR'
      req.bodyErrors.files[code] = req.bodyErrors.files[code] || []
      req.bodyErrors.files[code].push({fieldname, originalname})
    }

    let busboy

    try {
      busboy = new Busboy({headers: req.headers, limits: limits, preservePath: preservePath})
    } catch (err) {
      return next(err)
    }

    let appender = new FileAppender(fileStrategy, req)
    let isDone = false
    let readFinished = false
    let errorOccured = false
    let pendingWrites = new Counter()
    let uploadedFiles = []

    function done (err) {
      if (isDone) return
      isDone = true

      req.unpipe(busboy)
      drainStream(req)
      busboy.removeAllListeners()

      onFinished(req, function () { next(err) })
    }

    function indicateDone () {
      if (readFinished && pendingWrites.isZero() && !errorOccured) done()
    }

    function abortWithError (uploadError) {
      if (errorOccured) return
      errorOccured = true

      pendingWrites.onceZero(function () {
        function remove (file, cb) {
          storage._removeFile(req, file, cb)
        }

        removeUploadedFiles(uploadedFiles, remove, function (err, storageErrors) {
          if (err) return done(err)

          uploadError.storageErrors = storageErrors
          done(uploadError)
        })
      })
    }

    function abortWithCode (code, optionalField) {
      abortWithError(new MulterError(code, optionalField))
    }

    // handle text field data
    busboy.on('field', function (fieldname, value, fieldnameTruncated, valueTruncated) {
      if (fieldnameTruncated) return abortWithCode('LIMIT_FIELD_KEY')
      if (valueTruncated) return abortWithCode('LIMIT_FIELD_VALUE', fieldname)

      // Work around bug in Busboy (https://github.com/mscdex/busboy/issues/6)
      if (limits && limits.hasOwnProperty('fieldNameSize')) {
        if (fieldname.length > limits.fieldNameSize) return abortWithCode('LIMIT_FIELD_KEY')
      }

      appendField(req.body, fieldname, value)
    })

    // handle files
    busboy.on('file', function (fieldname, fileStream, filename, encoding, mimetype) {
      // don't attach to the files object, if there is no file
      if (!filename) return fileStream.resume()

      // Work around bug in Busboy (https://github.com/mscdex/busboy/issues/6)
      if (limits && limits.hasOwnProperty('fieldNameSize')) {
        if (fieldname.length > limits.fieldNameSize) return abortWithCode('LIMIT_FIELD_KEY')
      }

      let file = {
        fieldname: fieldname,
        originalname: filename,
        encoding: encoding,
        mimetype: mimetype
      }

      let placeholder = appender.insertPlaceholder(file)

      fileFilter(req, file, function (err, includeFile) {
        if (err) {
          addFilesError(fieldname, err, filename)
          appender.removePlaceholder(placeholder)
          return abortWithError(err)
        }

        if (!includeFile) {
          appender.removePlaceholder(placeholder)
          return fileStream.resume()
        }

        let aborting = false
        pendingWrites.increment()

        Object.defineProperty(file, 'stream', {
          configurable: true,
          enumerable: false,
          value: fileStream
        })

        fileStream.on('error', function (err) {
          addFilesError(fieldname, err, filename)
          pendingWrites.decrement()
          abortWithError(err)
        })

        fileStream.on('limit', function () {
          addFilesError(fieldname, 'LIMIT_FILE_SIZE', filename)
          aborting = true
          abortWithCode('LIMIT_FILE_SIZE', fieldname)
        })

        storage._handleFile(req, file, function (err, info) {
          if (aborting) {
            appender.removePlaceholder(placeholder)
            uploadedFiles.push(extend(file, info))
            return pendingWrites.decrement()
          }

          if (err) {
            addFilesError(fieldname, err, filename)
            appender.removePlaceholder(placeholder)
            pendingWrites.decrement()
            return abortWithError(err)
          }

          let fileInfo = extend(file, info)

          appender.replacePlaceholder(placeholder, fileInfo)
          uploadedFiles.push(fileInfo)
          pendingWrites.decrement()
          indicateDone()
        })
      })
    })

    busboy.on('error', function (err) { abortWithError(err) })
    busboy.on('partsLimit', function () { abortWithCode('LIMIT_PART_COUNT') })
    busboy.on('filesLimit', function () { abortWithCode('LIMIT_FILE_COUNT') })
    busboy.on('fieldsLimit', function () { abortWithCode('LIMIT_FIELD_COUNT') })
    busboy.on('finish', function () {
      readFinished = true
      indicateDone()
    })

    req.pipe(busboy)
  }
}

module.exports = makeMiddleware