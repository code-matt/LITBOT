require('dotenv').config()
var talib = require('talib')
console.log('TALib Version: ' + talib.version)
const binance = require('node-binance-api')
var _ = require('lodash')
require('./modified_modules/lodash-math')(_)

var blessed = require('blessed')
var contrib = require('./modified_modules/blessed-contrib')
var chalk = require('chalk')
var screen = blessed.screen()

var scale = require('scale-number-range')
var ema = require('exponential-moving-average');

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
    this.recalculateMarks = this.recalculateMarks.bind(this)
    this.calculateEMA = this.calculateEMA.bind(this)

    this.renderLoading = this.renderLoading.bind(this)

    this.AROONDOWN = 0
    this.AROONUP = 0
    this.AROON_OCCILATION = 0
    this.ADX = []
    this.DI_OCCILATION = 0
    this.PLUSDI = []
    this.MINUSDI = []
    this.chunks = [{close: 0}]
    this.tick = 0

    this.movement = null

    this.litbotLog = []
    this.marks = []
    this.pricePool = []

    this.litbotLoading = true

    binance.options({
      'APIKEY': process.env.BINANCE_PUBLIC_KEY,
      'APISECRET': process.env.BINANCE_SECRET_KEY
    })
    console.log('Initiating LitBot!')

    // this.chunks = []
    this.symbol = 'XRPBTC'
    this.prettyName = 'XRP'
    this.base = 'BTCUSDT'
    this.grid = new contrib.grid({rows: 12, cols: 12, screen: screen})
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
    this.updatePrices(true).then(done => {

    })
    setInterval(this.updatePrices, 5000)

    this.prices = null
    this._XRP = 0 // start with 0 ripple.. bot decides when to make the first buy
    this._BTC = 0.05 // start with 0.05 BTC
  }

  calculateAndDraw () {
    this.calculateEMA().then(done => {
      if (this.litbotLoading) {
        this.renderLoading()
      } else {
        this.renderDashboard()
      }
    })
  }

  calculateEMA () {
    return new Promise((resolve, reject) => {
      if (this.marks.length === 10) {
        this.EMA = ema(this.marks, {
          range: 5,
          format: n => Number(n.toFixed(8))
        })
      }
      resolve(true)
    })
  }

  renderLoading () {
    this.grid.set(0, 0, 12, 12, contrib.donut,
      {
        label: 'LITBOT',
        radius: 30,
        arcWidth: 3,
        yPadding: 2,
        data: [
          {percent: this.marks.length / 10, label: 'gathering price data', color: 'blue'}
        ]
      }
    )

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0)
    })

    screen.render()
  }

  renderDashboard () {
    let prices = _.takeRight(this.pricePool.map(priceObj => priceObj.price), 10)
    var data = [
      {
        title: 'Closing Price',
        x: Array.apply(null, {length: 10}).map(Number.call, Number).map(String),
        y: prices.map(value => scale(value, _.min(prices), _.max(prices), _.minBy(prices), _.maxBy(prices)))
      },
      {
        title: 'EMA',
        y: this.marks.map(value => scale(value, _.min(this.marks), _.max(this.marks), _.minBy(prices), _.maxBy(prices))),
        style: {
          line: 'red'
        }
      }
    ]

    this.grid.set(6, 0, 6, 6, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 10,
        xLabelPadding: 3,
        xPadding: 5,
        label: `${this.symbol} closing price`,
        minY: _.minBy(prices),
        maxY: _.maxBy(prices),
        numYLabels: 7,
        data: data,
        showLegend: false,
        legend: {width: 20}
      }
    )
    this.grid.set(6, 6, 6, 6, contrib.markdown,
      {
        markdown: this.reportProgress()
      }
    )
    this.grid.set(0, 4, 6, 2, contrib.line,
      {
        style: {
          line: 'yellow',
          text: 'green',
          baseline: 'black'
        },
        yLength: 0,
        yLabelPadding: -30,
        xLabelPadding: 0,
        xPadding: 0,
        label: `LITBOT EARNINGS/LOSSES`,
        minY: -0.2,
        maxY: 0.2,
        numYLabels: 4,
        data: [
          {
            x: Array.apply(null, {length: 5}).map(Number.call, Number).map(String),
            y: [0.002, -0.05, 0.04, 0.02, 0.04]
          },
          {
            y: [0, 0, 0, 0, 0],
            style: {
              line: 'red'
            }
          }
        ]
      }
    )
    this.grid.set(0, 0, 6, 4, contrib.markdown,
      {
        markdown: this.reportProgress()
      }
    )
    this.grid.set(0, 6, 6, 3, contrib.markdown,
      {
        markdown: this.reportDecicionStatus()
      }
    )

    this.grid.set(0, 9, 6, 3, contrib.markdown,
      {
        markdown: this.LITBOTLOG()
      }
    )

    screen.key(['escape', 'q', 'C-c'], function (ch, key) {
      return process.exit(0)
    })

    screen.render()
  }

  LITBOTLOG () {
    let output = ``
    this.litbotLog.forEach(message => {
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
          let time = process.hrtime()[0] // seconds since program started
          this.prices = ticker
          this.addPriceToPool(this.prices.XRPBTC, time)
          resolve(true)
        })
      } catch (err) {
        console.log('GET PRICES HAS AN ERROR')
      }
    })
  }

  addPriceToPool (price, time) {
    if (this.marks.length > 9) {
      this.pricePool.shift()
    }
    this.pricePool.push({
      price: Number(price),
      time: time
    })
    if (this.ticks < 2) {
      return
    }
    this.recalculateMarks()
  }

  recalculateMarks () {
    let timePassed = 0
    let newMarks = []
    let tempPool = []
    let lastTime = this.pricePool[0].time
    this.pricePool.forEach((price, index) => {
      if (index !== 0) {
        timePassed += price.time - lastTime
      }
      if (timePassed > 10 && tempPool.length > 1) {
        newMarks.push(_.reduce(tempPool, (sum, n) => sum + n.price, 0) / tempPool.length) // average the prices from 15s~
        this.tempPool = []
        timePassed = 0
      } else {
        tempPool.push(price)
      }
      lastTime = price.time
    })
    this.marks = newMarks
    if (this.marks.length > 9 && this.litbotLoading) {
      this.litbotLoading = false
    }
    this.calculateAndDraw()
  }

  buyHoldSellDecision () {
    return new Promise((resolve, reject) => {
      if (this.AROON_OCCILATION > 20 && this.DI_OCCILATION > 10 && this.ADX[this.ADX.length - 1] > 16) {
        if (this._BTC) {
          this.doBuy()
        }
      } else {
        if (this._XRP) {
          this.doSell()
        }
      }
      resolve(true)
    })
  }

  doBuy () {
    // console.log(`

    //   **********************************************
    //   LITBOT is buying XRP with 100% of BTC balance
    //   **********************************************

    // `)
    this._XRP = (this._BTC * this.prices.BTCUSDT) / (this.prices.BTCUSDT * this.prices.XRPBTC)
    this._BTC = 0
    this.litbotLog.push(`litbot is buying: price - ${(this.prices.BTCUSDT * this.prices.XRPBTC).toFixed(2)}`)
  }

  doSell () {
    // console.log(`

    //   *************************************
    //   LITBOT is selling 100% of XRP balance
    //   *************************************

    // `)
    this._BTC = (this._XRP * (this.prices.BTCUSDT * this.prices.XRPBTC)) / this.prices.BTCUSDT
    this._XRP = 0
    this.litbotLog.push(`litbot is selling: price - ${(this.prices.BTCUSDT * this.prices.XRPBTC).toFixed(2)}`)
  }

  reportProgress () {
    return (`
      LITBOT PROGRESS REPORT(Started with 0.05 BTC):
      Current BTC/USDT Value: ${this.prices.BTCUSDT}
      Current XRP/BTC Value: ${this.prices.XRPBTC}
      Aprox USD value of XRP: ${this.prices.BTCUSDT * this.prices.XRPBTC}
      -------------------------
      Balances:
                    XRP: ${this._XRP}
                    BTC: ${this._BTC}
      Wallet Value: 
                    XRP(usd): ${this._XRP * (this.prices.BTCUSDT * this.prices.XRPBTC)}
                    BTC(usd): ${this._BTC * this.prices.BTCUSDT}
    `)
  }

  reportDecicionStatus () {
    return (`
      Latest ADX: ${this.ADX[this.ADX.length - 1]}
      Latest PLUSDI: ${this.PLUSDI[this.PLUSDI.length - 1]}
      Latest MINUSDI: ${this.MINUSDI[this.MINUSDI.length - 1]}

      Latest AROONUP: ${this.AROONUP[this.AROONUP.length - 1]}
      Latest AROONDOWN: ${this.AROONDOWN[this.AROONDOWN.length - 1]}

      DI OCCILATION: ${this.DI_OCCILATION}
      AROON OCCILATION: ${this.AROON_OCCILATION}
    `)
  }

  calcMyXRPBalanceAndValue () {
    return new Promise((resolve, reject) => {
      let thingsToDo = 2
      let XRPUSDT, XRPETH, ETHUSDT, XRPPrice, XRPBalance

      binance.prices((ticker) => {
        ETHUSDT = ticker.ETHUSDT
        XRPETH = ticker.XRPETH
        console.log('Price of Ripple - Ethereum: ', XRPETH)
        console.log('Etherium price - USDT: ', ETHUSDT)
        thingsToDo -= 1
        binance.balance((balances) => {
          XRPBalance = balances.XRP.available
          XRPPrice = ETHUSDT * XRPETH
          XRPUSDT = XRPBalance * XRPPrice
          console.log('XRP balance: ', XRPBalance)
          console.log('XRP (aprox) USD value: ', XRPPrice)
          console.log('Your XRP (aprox) USD value: ', XRPUSDT)
          thingsToDo -= 1
          if (!thingsToDo) {
            resolve(true)
          }
        })
      })
    })
  }
}

new RippleBot()
