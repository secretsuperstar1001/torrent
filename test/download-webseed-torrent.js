var auto = require('run-auto')
var DHT = require('bittorrent-dht/server')
var fs = require('fs')
var parseTorrent = require('parse-torrent')
var test = require('tape')
var WebTorrent = require('../')

var http = require('http')
var serveStatic = require('serve-static')
var finalhandler = require('finalhandler')
var path = require('path')

var leavesPath = __dirname + '/content/Leaves of Grass by Walt Whitman.epub'
var leavesFilename = 'Leaves of Grass by Walt Whitman.epub'
var leavesFile = fs.readFileSync(leavesPath)
var leavesTorrent = fs.readFileSync(__dirname + '/torrents/leaves.torrent')
var leavesParsed = parseTorrent(leavesTorrent)

// remove trackers from .torrent file
leavesParsed.announce = []

test('Download using webseed (via .torrent file)', function (t) {
  t.plan(5)

  var serve = serveStatic(path.join(__dirname, './content'));
  var httpServer = http.createServer(function(req, res){
    var done = finalhandler(req, res)
    serve(req, res, done)
  })

  httpServer.on('error', function (err) {
    t.fail(err)
  })

  auto({
    httpPort: function (cb) {
      httpServer.listen(function () {
        var port = httpServer.address().port
        cb(null, port)
      })
    },
    client1: ['httpPort', function (cb, r) {

      leavesParsed.urlList.push('http://localhost:' + r.httpPort + '/' + leavesFilename);

      var client1 = new WebTorrent({
        tracker: false,
        dht: { bootstrap: false }
      })

      client1.on('error', function (err) { t.fail(err) })

      client1.on('torrent', function (torrent) {
        torrent.files.forEach(function (file) {
          file.getBuffer(function (err, buf) {
            if (err) throw err
            t.deepEqual(buf, leavesFile, 'downloaded correct content')
          })
        })

        torrent.once('done', function () {
          t.pass('client1 downloaded torrent from webseed')
          cb(null, client1)
        })
      });

      client1.add(leavesParsed)

    }]
  }, function (err, r) {
    t.error(err)
    r.client1.destroy(function () {
      t.pass('client1 destroyed')
    })
    httpServer.close(function () {
      t.pass('http server closed')
    })
  })
})
