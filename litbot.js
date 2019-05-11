require('dotenv').config()
var talib = require('talib')
console.log('TALib Version: ' + talib.version)
const binance = require('node-binance-api')
var _ = require('lodash')
require('./modified_modules/lodash-math')(_)

var blessed = require('blessed')
var contrib = require('./modified_modules/blessed-contrib')
var screen = blessed.screen()

var scale = require('scale-number-range')
var ema = require('exponential-moving-average')

var fs = require('fs')
if (!fs.existsSync('log.json')) {
  var filepath = 'log.json'
  let content = JSON.stringify({
    buySellLog: []
  })
  fs.writeFile(filepath, content, (err) => {
    console.log('logfile generated')
  })
}
require('events').EventEmitter.defaultMaxListeners = 300

const LITBOT_LOG_LENGTH = 4
const POLLING_INTERVAL = 1

const MARK_COUNT_SHORT = 10
const MARK_TIME_PERIOD_SHORT = 1

const MARK_COUNT_LONG = 8
const MARK_TIME_PERIOD_LONG = 15

class RippleBot {
  constructor () {
    // this line below is a hack to force this node process to stay open until closed.
    setInterval(() => {}, Number.POSITIVE_INFINITY)

    this.calcMyXRPBalanceAndValue = this.calcMyXRPBalanceAndValue.bind(this)
    this.buyHoldSellDecision = this.buyHoldSellDecision.bind(this)
    this.updatePrices = this.updatePrices.bind(this)
    this.reportProgress = this.reportProgress.bind(this)
    this.doBuy = this.doBuy.bind(this)
    this.doSell = this.doSell.bind(this)
    this.renderDashboard = this.renderDashboard.bind(this)
    this.LITBOTLOG = this.LITBOTLOG.bind(this)
    this.calculateAndDraw = this.calculateAndDraw.bind(this)
    this.addPriceToPool = this.addPriceToPool.bind(this)
    this.recalculateMarksShort = this.recalculateMarksShort.bind(this)
    this.recalculateMarksLong = this.recalculateMarksLong.bind(this)
    this.calculateEMAShort = this.calculateEMAShort.bind(this)
    this.calculateROC = this.calculateROC.bind(this)
    this.renderLoading = this.renderLoading.bind(this)
    this.updateBalances = this.updateBalances.bind(this)
    this.reportWallet = this.reportWallet.bind(this)
    this.finishRenderLoading = this.finishRenderLoading.bind(this)
    this.updateCandlesticks = this.updateCandlesticks.bind(this)
    this.getDepth = this.getDepth.bind(this)
    this.getTimePeriod = this.getTimePeriod.bind(this)
    this.calculateEMALong = this.calculateEMALong.bind(this)

    this.parseLog = this.parseLog.bind(this)
    this.writeLog = this.writeLog.bind(this)

    this.tick = 0

    this.ROCBoughtAt = null

    this.movement = null

    this.lastPriceTime = null

    this.parseLog().then(async log => {
      this.litbotLog = log
      this.marksShort = []
      this.marksLong = []
      this.pricePool = []
      this.ranges = {
        // '1h': {
        //   low: null,
        //   high: null
        // },
        '24h': {
          low: null,
          high: null
        }
      }

      this.litbotLoading = true
      this.lastPrice = 0

      binance.options({
        'APIKEY': process.env.BINANCE_PUBLIC_KEY,
        'APISECRET': process.env.BINANCE_SECRET_KEY
      })
      console.log('Initiating LitBot!')

      this.symbol = 'BNBBTC'
      this.prettyName = 'BNB'
      this.base = 'BTCUSDT'
      this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen, hideBorder: true})
      this.tree = this.grid.set(6, 11, 6, 1, contrib.tree,
        { style: { text: 'red' },
         template: { lines: true },
         label: 'LITBOT Coins and Strategies'}
      )
      this.tree.setData({
        extended: true,
        children: {
          XRPBTC: {
            extended: true,
            children: {
              ADX: {name: 'ADX MODE', test: 'test'}
            }
          }
        }
      })
      this.selected = null
      this.tree.on('select', (node) => {
        this.selected = node
      })
      this.tree.focus()
      screen.key(['tab'], (ch, key) => {
        console.log(this.selected.parent.name)
      })
      await this.updatePrices(true)
      this.depth = {
        asks: [],
        buys: []
      }
      await this.getDepth()
      setInterval(this.getDepth, 5000)
      setInterval(this.updatePrices, POLLING_INTERVAL * 1000)
      await this.updateCandlesticks()
      setInterval(this.updateCandlesticks, 60000 * 5)

      this.prices = null
      this._coinBalance = 0 // start with 0 ripple.. bot decides when to make the first buy
      this._BTC = 0.5 // start with 0.05 BTC

      this.coins = ['POE', 'XRP', 'BNB', 'BRD', 'BTC']
      await this.updateBalances()
      setInterval(this.updateBalances, 120000)
      this.calculateAndDraw()
    })
  }

  parseLog () {
    return new Promise((resolve, reject) => {
      fs.readFile('log.json', 'utf8', (err, data) => {
        resolve(JSON.parse(data).buySellLog)
      })
    })
  }

  writeLog () {
    fs.writeFile('log.json', JSON.stringify({buySellLog: this.litbotLog}), (err) => {})
  }

  getDepth () {
    return new Promise((resolve, reject) => {
      binance.bookTickers(tickers => {
        this.depth = {
          asks: Number(tickers[this.symbol].asks),
          bids: Number(tickers[this.symbol].bids)
        }
        resolve(true)
      })
    })
  }

  async calculateAndDraw () {
    if (this.litbotLoading) {
      await this.renderLoading()
    } else {
      await this.calculateEMAShort()
      await this.calculateEMALong()
      await this.calculateROC()
      await this.buyHoldSellDecision()
      await this.renderDashboard()
    }
    setTimeout(() => {
      this.calculateAndDraw()
    }, 200)
  }

  renderLoading () {
    return new Promise((resolve, reject) => {
      this.grid.set(2, 4, 6, 6, contrib.picture, {
        cols: 90,
        file: './litbotlogo.png',
        onReady: this.finishRenderLoading(resolve)
      })
    })
  }

  finishRenderLoading (resolve) {
    this.grid.set(5, 0, 7, 12, contrib.donut,
      {
        label: '',
        radius: 30,
        arcWidth: 3,
        yPadding: 2,
        data: [
          {percent: this.marksLong.length / MARK_COUNT_LONG, label: 'gathering price data', color: 'blue'}
        ]
      }
    )

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0)
    })

    screen.render()
    resolve(true)
  }

  renderDashboard () {
    return new Promise((resolve, reject) => {
      var data = [
        {
          title: 'Average Price',
          x: Array.apply(null, {length: this.EMASHORT.length}).map(Number.call, Number).map(String),
          y: this.marksShort
        },
        {
          title: 'EMA SHORT',
          y: this.EMASHORT.map(value => scale(value, _.min(this.EMASHORT), _.max(this.EMASHORT), _.minBy(this.marksShort), _.maxBy(this.marksShort))),
          style: {
            line: 'red'
          }
        }
      ]
  
      var data2 = [
        {
          title: 'EMA LONG',
          x: Array.apply(null, {length: this.EMALONG.length}).map(Number.call, Number).map(String),
          y: this.EMALONG,
          style: {
            line: 'red'
          }
        }
      ]
  
      let pricePoolMapped = this.pricePool.map(priceObj => priceObj.price)
      var data3 = [
        {
          title: 'Raw Price Data',
          x: Array.apply(null, {length: pricePoolMapped.length}).map(Number.call, Number).map(String),
          // y: pricePoolMapped.map(value => scale(value, _.min(pricePoolMapped), _.max(pricePoolMapped), _.minBy(pricePoolMapped), _.maxBy(pricePoolMapped)))
          y: pricePoolMapped
        }
      ]
  
      this.grid.set(6, 0, 6, 8, contrib.line,
        {
          style: {
            line: 'yellow',
            text: 'green',
            baseline: 'black'
          },
          yLength: 10,
          xLabelPadding: 3,
          xPadding: 5,
          label: `${this.symbol} Average Price / EMA. - Moving ${MARK_TIME_PERIOD_SHORT}s periods`,
          minY: _.minBy(this.marksShort) - 0.00000002,
          maxY: _.maxBy(this.marksShort) + 0.00000002,
          numYLabels: 7,
          data: data,
          showLegend: false,
          legend: {width: 20}
        }
      )
      let depthMax = this.depth.asks >= this.depth.bids ? this.depth.asks : this.depth.bids
      this.grid.set(6, 8, 6, 1, contrib.bar,
        {
          label: 'Market Depth',
          barWidth: 4,
          barSpacing: 6,
          xOffset: 3,
          maxHeight: 10,
          data: {titles: ['Buys', 'Sells'], data: [scale(this.depth.asks, 0, depthMax, 0, 10), scale(this.depth.bids, 0, depthMax, 0, 10)]}
        }
      )
      this.grid.set(8, 9, 4, 3, contrib.markdown,
        {
          markdown: this.reportWallet()
        }
      )
  
      this.grid.set(0, 0, 6, 2, contrib.markdown,
        {
          markdown: this.reportProgress()
        }
      )
      this.grid.set(0, 2, 3, 7, contrib.line,
        {
          style: {
            line: 'yellow',
            text: 'green',
            baseline: 'black'
          },
          yLength: 10,
          xLabelPadding: 3,
          xPadding: 5,
          label: `${this.symbol} LONG EMA. - Moving ${MARK_TIME_PERIOD_LONG}s periods`,
          minY: _.minBy(this.EMALONG) - 0.00000023, // - 0.00000023
          maxY: _.maxBy(this.EMALONG) + 0.00000023,
          numYLabels: 7,
          data: data2,
          showLegend: false,
          legend: {width: 20}
        }
      )
  
      this.grid.set(3, 2, 3, 7, contrib.line,
        {
          style: {
            line: 'yellow',
            text: 'green',
            baseline: 'black'
          },
          yLength: 10,
          xLabelPadding: 3,
          xPadding: 5,
          label: `${this.symbol} Raw Price Data - Aprox ${POLLING_INTERVAL}s`,
          minY: _.minBy(pricePoolMapped) - 0.00000023,
          maxY: _.maxBy(pricePoolMapped) + 0.00000023,
          numYLabels: 7,
          data: data3,
          showLegend: false,
          legend: {width: 20}
        }
      )
  
      this.grid.set(0, 9, 8, 3, contrib.markdown,
        {
          markdown: this.LITBOTLOG()
        }
      )
  
      screen.key(['escape', 'q', 'C-c'], function (ch, key) {
        return process.exit(0)
      })
  
      screen.render()
      resolve(true)
    })
  }

  LITBOTLOG () {
    let messages = _.takeRight(this.litbotLog, LITBOT_LOG_LENGTH)
    let output = ``
    messages.forEach(message => {
      output += `
        ${message}
      `
    })
    return output
  }

  updatePrices (initial) {
    return new Promise((resolve, reject) => {
      try {
        binance.prices((ticker) => {
          this.tick += 1
          let time = Date.now()
          this.prices = ticker
          this.addPriceToPool(this.prices[this.symbol], time)
          resolve(true)
        })
      } catch (err) {
        console.log('GET PRICES HAS AN ERROR')
      }
    })
  }

  // BIG TODO: Start storing all these in a database for
  // backtesting and also machine learning.
  addPriceToPool (price, time) {
    if (!this.pricePool.length) {
      this.lastPriceTime = time - 1000
    }
    if (this.marksLong.length >= MARK_COUNT_LONG && !this.litbotLoading) {
      this.pricePool.splice(0, 1)
    }
    this.pricePool.push({
      price: Number(price),
      time: Number(time - this.lastPriceTime) / 1000
    })
    this.lastPriceTime = time
    if (this.ticks < 2) {
      return
    }
    this.recalculateMarksShort()
    this.recalculateMarksLong()
  }

  getTimePeriod (durationSec) {
    // go backwards and stop filling array once we hit durationSec
    let newPricePool = []
    let timePassed = 0
    for (let i = this.pricePool.length - 1; i > 0; i--) {
      if (this.pricePool.length !== 1) {
        timePassed += this.pricePool[i].time
        if (timePassed <= durationSec + POLLING_INTERVAL) {
          // since we are going backwards... we fill the array from the front for them
          // to be in correct chronological order.
          newPricePool.unshift(this.pricePool[i])
        }
      }
    }
    return newPricePool
  }

  recalculateMarksShort () {
    this.marksShort = _.takeRight(this.pricePool, MARK_COUNT_SHORT).map(priceObj => priceObj.price)
  }

  recalculateMarksLong () {
    let timePassed = 0
    let newMarks = []
    let tempPool = []
    let inDuration = this.getTimePeriod((MARK_TIME_PERIOD_LONG * MARK_COUNT_LONG) + 10)
    inDuration.forEach((price, index) => {
      if (index !== 0) {
        timePassed += price.time
        if (timePassed > MARK_TIME_PERIOD_LONG - POLLING_INTERVAL && tempPool.length > 1) {
          newMarks.push(_.reduce(tempPool, (sum, n) => sum + n.price, 0) / tempPool.length)
          tempPool = []
          timePassed = 0
        } else {
          tempPool.push(price)
        }
      }
    })
    this.marksLong = newMarks
    if (this.marksLong.length >= MARK_COUNT_LONG && this.litbotLoading) {
      this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen})
      this.litbotLoading = false
    }
    // this.calculateAndDraw()
  }

  calculateEMAShort () {
    return new Promise((resolve, reject) => {
      if (this.marksShort.length >= MARK_COUNT_SHORT) {
        this.EMASHORT = ema(this.marksShort, {
          range: 2,
          format: n => Number(n.toFixed(8))
        })
      }
      resolve(true)
    })
  }

  calculateEMALong () {
    return new Promise((resolve, reject) => {
      if (this.marksLong.length >= MARK_COUNT_LONG) {
        this.EMALONG = ema(this.marksLong, {
          range: 2,
          format: n => Number(n.toFixed(8))
        })
      }
      resolve(true)
    })
  }

  calculateROC () {
    return new Promise ((resolve, reject) => {
      let changes = []
      this.EMASHORT.forEach((mark, index) => {
        if (index !== 0) {
          let time = (index + 1) * POLLING_INTERVAL
          let prevTime = (index) * POLLING_INTERVAL
          changes.push(100000000 / ((time - prevTime) / (mark - this.EMASHORT[index - 1])))
        }
      })
      this.changes = changes
      this.averageROC = (this.changes.reduce((a, b) => a + b, 0) / this.EMASHORT.length).toFixed(3)
  
      changes = []
      this.EMALONG.forEach((mark, index) => {
        if (index !== 0) {
          let time = (index + 1) * POLLING_INTERVAL
          let prevTime = (index) * POLLING_INTERVAL
          changes.push(100000000 / ((time - prevTime) / (mark - this.EMALONG[index - 1])))
        }
      })
      this.changes = changes
      this.averageROCLong = (this.changes.reduce((a, b) => a + b, 0) / this.EMALONG.length).toFixed(3)
      resolve(true)
    })
  }

  updateCandlesticks () {
    return new Promise((resolve, reject) => {
      binance.prevDay(this.symbol, (prevDay, symbol) => {
        this.ranges['24h'] = {
          low: Number(prevDay.lowPrice),
          high: Number(prevDay.highPrice)
        }
      })
      resolve(true)
    })
  }

  buyHoldSellDecision () {
    return new Promise(async (resolve, reject) => {
      // if (this.averageROC >= 1 && this.averageROCLong > 5) {
      if (this._coinBalance && (this.averageROCLong < -5)) {
        await this.doSell()
        resolve(true)
        return
      }
      if (this._BTC && this.averageROCLong > 10) {
        await this.doBuy()
        resolve(true)
      } else {
        resolve(true)
      }
    })
  }

  doBuy () {
    return new Promise((resolve, reject) => {
      this.ROCBoughtAt = this.averageROC
      this.buyPrice = this.prices[this.symbol]
      this._coinBalance = (this._BTC * this.prices.BTCUSDT) / (this.prices.BTCUSDT * this.prices[this.symbol])
      this._BTC = 0
      this.litbotLog.push(`
       LITBOT is buying:
       ROCBoughtAt: ${this.ROCBoughtAt}
       ${this.symbol} Price: ${this.prices[this.symbol]}
       `)
      this.writeLog()
      resolve(true)
    })
  }

  doSell () {
    return new Promise((resolve, reject) => {
      let profit = (this.prices[this.symbol] - this.buyPrice).toFixed(8)
      this.buyPrice = null
      this._BTC = (this._coinBalance * (this.prices.BTCUSDT * this.prices[this.symbol])) / this.prices.BTCUSDT
      this._coinBalance = 0
      this.litbotLog.push(`
       LITBOT is selling:
       ROCSoldAt: ${this.averageROC}
       ${this.symbol} Price: ${this.prices[this.symbol]}
       ${this.symbol} gain/loss: ${profit}
       `)
      this.writeLog()
      resolve(true)
    })
  }

  updateBalances () {
    return new Promise((resolve, reject) => {
      binance.balance(balances => {
        this.balances = balances
        resolve(true)
      })
    })
  }

  reportProgress () {
    if (this.buyPrice) {
      var BTCmessage = `${this.prettyName} price change since buy: ${(this.prices[this.symbol] - this.buyPrice).toFixed(8)}`
    } else {
      var BTCmessage = `${this.prettyName} price change since buy: N/A`
    }
    return (`
      LITBOT REPORT:
      (Started with 0.5 BTC)
        ${this.prettyName}: ${this._coinBalance}
        BTC: ${this._BTC}
      ${BTCmessage}
      --------------------
      AVERAGE ROC SHORT: ${this.averageROC}
      AVERAGE ROC LONG: ${this.averageROCLong}

      NUM OF SHORT MARKS: ${this.marksShort.length}
      NUM OF LONG MARKS: ${this.marksLong.length}
      NUM IN PRICE POOL: ${this.pricePool.length}
      24h high: ${this.ranges['24h'].high.toFixed(10)}
      24h low: ${this.ranges['24h'].low.toFixed(10)}
    `)
  }

  reportDecicionStatus () {
    return (`
      AVERAGE ROC: ${this.averageROC}
      NUM OF MARKS: ${this.marksShort.length}
      NUM IN PRICE POOL: ${this.pricePool.length}
    `)
  }

  reportWallet () {
    if (this.balances) {
      let output = ``
      let totalValue = 0
      let value
      this.coins.forEach(coin => {
        if (coin !== 'BTC') {
          value = (this.prices[`${coin}BTC`] * this.balances[coin].available) * this.prices.BTCUSDT
        } else {
          value = (this.prices.BTCUSDT * this.balances[coin].available)
        }
        output += `
          ${coin}: ${Number(this.balances[coin].available).toFixed(3)} ---- Value: ${value}
        `
        totalValue += value
      })
      return (
        `Your Wallet:
  
        ${output} 
        
        Total walet value: ${totalValue}`
      )
    } else {
      return (`
        Wallet data retreival failed! =(
      `)
    }
  }

  calcMyXRPBalanceAndValue () {
    return new Promise((resolve, reject) => {
      let XRPUSDT, XRPETH, ETHUSDT, XRPPrice, XRPBalance

      binance.prices((ticker) => {
        ETHUSDT = ticker.ETHUSDT
        XRPETH = ticker.XRPETH
        binance.balance((balances) => {
          XRPBalance = balances.XRP.available
          XRPPrice = ETHUSDT * XRPETH
          XRPUSDT = XRPBalance * XRPPrice
          resolve(true)
        })
      })
    })
  }
}

new RippleBot()
