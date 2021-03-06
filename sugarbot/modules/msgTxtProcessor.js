const constants = require('./constants.js')

const requestPromise = require('request-promise')
const {Wit} = require('node-wit')
const witClient = new Wit({accessToken: process.env.WIT_TOKEN})

const oc = require('./conversations/originalConv.js')
const sdc = require('./conversations/sevenDayClient.js')

exports.msgTxtProcessor = function(firebase, messageText, userId,
                                   favorites, timezone, name, timestamp, date) {
  // console.log('Entering wit proccessing area for: ', messageText)

  return witClient.message(messageText, {})
  .then((data) => {
    console.log('Processing Wit.ai data...')
    if (constants.testUsers.includes(userId)) {
      const profileRef = firebase.database().ref("/global/sugarinfoai/" + userId + "/profile/")
      return profileRef.once("value")
      .then(function(snapshot) {
        const challenge = snapshot.child('challenge').val()
        if (challenge === 'in progress') {
          return sdc.processWit(firebase, data,
                                messageText, userId,
                                favorites, timezone, name, timestamp, date)
        } else {
          return oc.processWit(firebase, data,
                               messageText, userId,
                               favorites, timezone, name, timestamp, date)
        }
      })
    } else {
      console.log('  with original conversation module.')
      return oc.processWit(firebase, data,
                           messageText, userId,
                           favorites, timezone, name, timestamp, date)
    }})
  .catch(error => {console.log('Wit.ai Error: ', error)});
}
