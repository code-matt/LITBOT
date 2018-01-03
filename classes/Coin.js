export default class Coin {
  constructor (initialState) {
    this.state = initialState
  }

  setState (nextState) {
    this.state = {
      ...this.state,
      nextState
    }
  }

  outputInfo () {
    return (
      `
        24 Hour high: 
      `
    )
  }
}
